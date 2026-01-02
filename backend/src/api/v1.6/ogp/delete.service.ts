import type { RequestBody, Response200 } from './delete.schema.js';
import { RequestBodySchema } from './delete.schema.js';

import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';
import { atpService } from '../../../common/environments.js';

import { AtpAgent } from '@atproto/api';

import { S3ClientWrapper } from '../../../lib/s3.js';
import { RedisClient } from '../../../lib/redis.js';
import { legacyDbEndpoint } from '../../../common/environments.js';
import { getThreadPost } from '../../../lib/bsky.js';

/*
 * Redis のレコードと S3 上の OGP ファイルを削除するメソッド
 * @param requestBody - リクエストボディ
 * @returns 削除した OGP のキー名を返す
 */
const deleteOgp = async (
    requestBody: RequestBody
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedBody = RequestBodySchema.parse(requestBody);
        logger.debug(`deleteOgp called with pageId: ${parsedBody.pageId}`);

        const dbPlace = parsedBody.pageId.split('/')[0];
        const dbKeyname = parsedBody.pageId.split('/')[1];

        const hashKey = dbKeyname.split('@')[1];
        let didFromDb = dbKeyname.split('@')[0];

        let context = 'app.bsky.feed.post';
        // オブジェクトストレージのキーは <did>/<postId>.jpg 形式に変更
        let ogpKeyname = `${dbKeyname.replace('@', '/')}.jpg`;
        let redisClient: RedisClient = new RedisClient();
        let handleFromDb = '';

        // レガシーDBの場合の分岐、DBがクリアされたら除去する
        // レガシーDBではpageIdがhandleのため、変数を置き換える。
        if (dbPlace === 'legacy') {
            handleFromDb = didFromDb;
            if (parsedBody.did === undefined) {
                logger.error('did is required for legacy db endpoint');
                return {
                    success: false,
                    error: 'BadRequest',
                };
            }
            didFromDb = parsedBody.did;
            redisClient = new RedisClient({
                endpoint: legacyDbEndpoint,
            });
            logger.debug(`Using legacy Redis endpoint for dbPlace`);
        } else {
            // dbPlaceの設定があるpageIdの場合はDBを選択する
            if (!Number.isInteger(Number(dbPlace))) {
                return {
                    success: false,
                    error: 'BadRequest',
                };
            }
            redisClient = new RedisClient({
                dbIndex: Number(dbPlace),
            });
            logger.debug(`Using Redis DB index for dbPlace. Index: ${dbPlace}`);
        }

        {
            // Redis レコードの確認
            const record = await redisClient.getPage(dbKeyname);
            if (!record) {
                logger.debug(`Ogp record not found in Redis: ${dbKeyname}`);
                return {
                    success: false,
                    error: 'BadRequest',
                };
            }
            // context情報があれば上書きする
            context = record.context !== undefined ? record.context : context;
        }

        const agent = new AtpAgent({
            service: atpService,
        });
        {
            // handleからdidを取得し、accessJwtで自身を参照した際のhandleと突合する
            agent.sessionManager.session = {
                accessJwt: parsedBody.accessJwt,
                refreshJwt: '',
                handle: handleFromDb,
                did: didFromDb,
                active: true,
            };
            const postUri = `at://${didFromDb}/${context}/${hashKey}`;
            const post = await getThreadPost(agent, postUri);
            const authorDid = post.author.did;
            if (didFromDb !== authorDid) {
                logger.error(
                    `Identity verification failed: thread-author=${authorDid} from-db=${didFromDb}`
                );
                return {
                    success: false,
                    error: 'BadRequest',
                };
            }
            logger.info(
                `Identity verified: thread-author=${authorDid} from-db=${didFromDb}`
            );
        }

        if (dbPlace !== 'legacy') {
            // S3 オブジェクトの削除
            const s3Client = new S3ClientWrapper();
            await s3Client.deleteFromS3(ogpKeyname);
            logger.debug(`Ogp deleted from S3: ${ogpKeyname}`);
        } else {
            logger.debug(`Legacy Bucket Ogp deletion skipped: ${ogpKeyname}`);
        }

        {
            // Redis レコードの削除
            await redisClient.deletePage(dbKeyname);
            logger.debug(`Ogp info deleted from Redis: ${dbKeyname}`);
        }

        return {
            success: true,
            data: {
                result: 'ok',
            },
        };
    } catch (e: unknown) {
        if (e instanceof Error) {
            logger.error(e.message);
        }
        return {
            success: false,
            error: 'InternalServerError',
        };
    }
};

export default deleteOgp;
