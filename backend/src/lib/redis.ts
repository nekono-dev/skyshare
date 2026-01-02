import { dbEndpoints } from '../common/environments.js';
import Redis from 'ioredis';
import { z } from 'zod';

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
        })
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
        }
    ) {
        if (!opt.endpoint) {
            // 複数のエンドポイントがある場合、ランダムに選出する。
            this.redisIndex = (Math.random() * dbEndpoints.length) | 0;
        }
        if (opt.dbIndex !== undefined) {
            // index指定がある場合は優先する。
            this.redisIndex = opt.dbIndex;
        }
        this.endpoint = dbEndpoints[this.redisIndex];
        // endpoint指定がある場合は上書きする。
        if (opt.endpoint) {
            this.endpoint = opt.endpoint;
        }
        this.ttl = opt.ttl || DEFAULT_TTL;
    }

    private createClient() {
        return new Redis.default(this.endpoint);
    }

    async addPage(key: string, raw: PageDb): Promise<void> {
        const client = this.createClient();
        try {
            const body = Buffer.from(JSON.stringify(raw)).toString('base64');
            await client.set(key, body, 'EX', this.ttl);
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

export { RedisClient };
