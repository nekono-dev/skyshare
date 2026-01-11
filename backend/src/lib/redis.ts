import { dbEndpoints } from '../common/environments.js';
import Redis from 'ioredis';
import { z } from 'zod';
import { dbEndpointRule } from '../common/environments.js';
import { logger } from '../common/logger.js';

const DEFAULT_TTL = 60 * 60 * 24 * 365; // 365日

// upstashに登録する情報
const ZodPageDb = z.object({
    ogp: z.string(),
    handle: z.string().optional(),
    context: z.string().optional(),
    imgs: z.array(
        z.object({
            thumb: z.string(),
            alt: z.string(),
        }),
    ),
});

type PageDb = z.infer<typeof ZodPageDb>;

class RedisClient {
    private endpoint: string;
    private ttl: number;
    public redisIndex: number = 0;

    constructor(
        opt: {
            endpoint?: string;
            ttl?: number;
            dbIndex?: number;
        } = {
            endpoint: undefined,
            ttl: undefined,
            dbIndex: undefined,
        },
    ) {
        this.ttl = opt.ttl || DEFAULT_TTL;
        const now = new Date();

        // endpoint が直接指定されている場合はそれを使用する
        if (opt.endpoint) {
            this.endpoint = opt.endpoint;
            // dbIndex は明示されていれば保持
            if (opt.dbIndex !== undefined) this.redisIndex = opt.dbIndex;
            logger.debug(`Using specified Redis endpoint: ${this.endpoint}`);
            return;
        }

        // dbIndex が指定されている場合は優先
        if (opt.dbIndex !== undefined) {
            this.redisIndex = opt.dbIndex;
            this.endpoint = dbEndpoints[this.redisIndex];
            logger.debug(
                `Using specified dbIndex=${this.redisIndex} for Redis endpoint`,
            );
            return;
        }

        // dbEndpointRule が設定されている場合は配分ルールに従って選出
        try {
            const balancing = dbEndpointRule?.balancing;
            if (Array.isArray(balancing) && balancing.length > 0) {
                // ログ用の収集
                const invalidIndices: number[] = [];
                const blockedIndices: number[] = [];
                const zeroWeightIndices: number[] = [];
                const includedIndices: number[] = [];

                // 候補を集める
                const candidates: { index: number; weight: number }[] = [];

                for (const entry of balancing) {
                    const idx = entry.index;
                    if (typeof idx !== 'number') {
                        continue;
                    }
                    if (idx < 0 || idx >= dbEndpoints.length) {
                        invalidIndices.push(idx);
                        continue;
                    }

                    // registerBlock によるブロック判定
                    const rb = entry.registerBlock;
                    if (rb) {
                        if (rb.dateBefore && now < new Date(rb.dateBefore)) {
                            blockedIndices.push(idx);
                            continue;
                        }
                        if (rb.dateAfter && now >= new Date(rb.dateAfter)) {
                            blockedIndices.push(idx);
                            continue;
                        }
                    }

                    // 基本 weight
                    let weight =
                        typeof entry.weight === 'number' ? entry.weight : 1;

                    // migration による重み変更
                    const mig = entry.migration;
                    if (mig) {
                        if (mig.dateAfter && now >= new Date(mig.dateAfter)) {
                            weight =
                                typeof mig.weight === 'number'
                                    ? mig.weight
                                    : weight;
                        }
                        if (mig.dateBefore && now < new Date(mig.dateBefore)) {
                            weight =
                                typeof mig.weight === 'number'
                                    ? mig.weight
                                    : weight;
                        }
                    }

                    if (weight > 0) {
                        candidates.push({ index: idx, weight });
                        includedIndices.push(idx);
                    } else {
                        zeroWeightIndices.push(idx);
                    }
                }

                if (invalidIndices.length > 0) {
                    logger.error(
                        `dbEndpointRule contains invalid index(es) not present in DB_ENDPOINTS: ${invalidIndices.join(
                            ', ',
                        )} (endpoints length=${dbEndpoints.length})`,
                    );
                }

                if (blockedIndices.length > 0) {
                    logger.debug(
                        `dbEndpointRule blocked index(es) by registerBlock: ${blockedIndices.join(
                            ', ',
                        )}`,
                    );
                }

                if (zeroWeightIndices.length > 0) {
                    logger.debug(
                        `dbEndpointRule index(es) with zero weight (excluded): ${zeroWeightIndices.join(
                            ', ',
                        )}`,
                    );
                }

                const total = candidates.reduce((s, c) => s + c.weight, 0);
                if (total > 0) {
                    // 重み付きランダム選択
                    let r = Math.random() * total;
                    for (const c of candidates) {
                        r -= c.weight;
                        if (r <= 0) {
                            this.redisIndex = c.index;
                            this.endpoint = dbEndpoints[this.redisIndex];
                            logger.debug(
                                `dbEndpointRule selected index=${this.redisIndex}`,
                            );
                            return;
                        }
                    }
                    // まれに累積誤差で選ばれない場合、最後を選ぶ
                    const last = candidates[candidates.length - 1];
                    this.redisIndex = last.index;
                    this.endpoint = dbEndpoints[this.redisIndex];
                    logger.debug(
                        `dbEndpointRule selected index=${this.redisIndex} (fallback to last candidate)`,
                    );
                    return;
                }

                // ここに到達するのは balancing があったが候補が無かった場合
                logger.error(
                    `dbEndpointRule produced no available candidates. balancing entries=${
                        balancing.length
                    }, included=${includedIndices.join(', ') || '<none>'}`,
                );
            } else {
                logger.debug('dbEndpointRule: no balancing defined');
            }
        } catch (e: unknown) {
            // ルール適用に失敗した場合はフォールバックする
            logger.error(`dbEndpointRule processing failed: ${String(e)}`);
        }

        // フォールバック: ランダムに選出
        this.redisIndex = (Math.random() * dbEndpoints.length) | 0;
        this.endpoint = dbEndpoints[this.redisIndex];
        logger.debug(
            `Falling back to random endpoint selection: index=${this.redisIndex}`,
        );
    }

    private createClient() {
        return new Redis.default(this.endpoint);
    }

    // Upstash rate-limit を表す専用エラー
    // 呼び出し元はこのエラーをキャッチして 429 として扱える
    static UpstashRateLimitError = class UpstashRateLimitError extends Error {
        constructor(message?: string) {
            super(message);
            this.name = 'UpstashRateLimitError';
        }
    };

    private isUpstashRateLimitError(e: unknown): boolean {
        if (!e) return false;
        // ioredis のエラーや Upstash のレスポンスを幅広く検出する
        if (e instanceof Error) {
            const m = e.message || '';
            // Upstash のエラーメッセージのうち、指定された 2 種類のみを検出
            // - ERR max daily request limit exceeded
            // - ERR max requests limit exceeded
            if (
                /ERR max daily request limit exceeded|ERR max requests limit exceeded/i.test(
                    m,
                )
            )
                return true;
        }
        return false;
    }

    async addPage(key: string, raw: PageDb): Promise<void> {
        const client = this.createClient();
        try {
            const body = Buffer.from(JSON.stringify(raw)).toString('base64');
            await client.set(key, body, 'EX', this.ttl);
        } catch (e: unknown) {
            if (this.isUpstashRateLimitError(e)) {
                logger.warn(
                    `Upstash rate limit hit on set for index=${
                        this.redisIndex
                    }: ${String(e instanceof Error ? e.message : e)}`,
                );
                throw new RedisClient.UpstashRateLimitError(
                    String(e instanceof Error ? e.message : e),
                );
            }
            throw e;
        } finally {
            try {
                await client.quit();
            } catch (e) {
                // fallback to disconnect if quit fails
                try {
                    client.disconnect();
                } catch (_) {
                    // ignore
                }
            }
        }
    }

    async getPage(key: string): Promise<PageDb | undefined> {
        const client = this.createClient();
        try {
            const res = await client.get(key);
            if (!res) return undefined;

            try {
                const json = Buffer.from(res, 'base64').toString('utf8');
                const parsed = ZodPageDb.parse(JSON.parse(json));
                return parsed;
            } catch (e) {
                return undefined;
            }
        } catch (e: unknown) {
            if (this.isUpstashRateLimitError(e)) {
                logger.warn(
                    `Upstash rate limit hit on get for index=${
                        this.redisIndex
                    }: ${String(e instanceof Error ? e.message : e)}`,
                );
                throw new RedisClient.UpstashRateLimitError(
                    String(e instanceof Error ? e.message : e),
                );
            }
            throw e;
        } finally {
            try {
                await client.quit();
            } catch (e) {
                try {
                    client.disconnect();
                } catch (_) {
                    // ignore
                }
            }
        }
    }

    async deletePage(key: string): Promise<void> {
        const client = this.createClient();
        try {
            await client.del(key);
        } catch (e: unknown) {
            if (this.isUpstashRateLimitError(e)) {
                logger.warn(
                    `Upstash rate limit hit on del for index=${
                        this.redisIndex
                    }: ${String(e instanceof Error ? e.message : e)}`,
                );
                throw new RedisClient.UpstashRateLimitError(
                    String(e instanceof Error ? e.message : e),
                );
            }
            throw e;
        } finally {
            try {
                await client.quit();
            } catch (e) {
                try {
                    client.disconnect();
                } catch (_) {
                    // ignore
                }
            }
        }
    }
}

const UpstashRateLimitError = RedisClient.UpstashRateLimitError;

export { RedisClient, UpstashRateLimitError };
