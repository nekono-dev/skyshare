import type { RequestBody, Response200 } from './post.schema.js';
import { RequestBodySchema } from './post.schema.js';

import { atpService } from '../../../common/environments.js';
import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';

import { Buffer } from 'buffer';
import { compositeImages } from '../../../lib/ogp.js';
import { AtpAgent } from '@atproto/api';
import { getThreadPost, extractImagesFromPost } from '../../../lib/bsky.js';
import { S3ClientWrapper } from '../../../lib/s3.js';
import { RedisClient } from '../../../lib/redis.js';

/* *
 * OGP画像を生成してS3にアップロードするメソッド
 * @param requestBody - リクエストボディ
 * @returns OGP画像のURIを含むレスポンス
 */
const postOgp = async (
    requestBody: RequestBody,
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedBody = RequestBodySchema.parse(requestBody);

        const agent = new AtpAgent({
            service: atpService,
        });
        const did = parsedBody.uri.split('/')[2];
        const context = parsedBody.uri.split('/')[3];
        const postId = parsedBody.uri.split('/')[4];

        const ogpKeyname = `${did}/${postId}.jpg`;
        const dbKeyname = `${did}@${postId}`;
        let images;
        let ogpUrl;
        let handle: string = '';

        {
            // Blueskyの投稿内容を取得する処理
            agent.sessionManager.session = {
                accessJwt: parsedBody.accessJwt,
                refreshJwt: '',
                handle: '',
                did: did,
                active: true,
            };
            try {
                const post = await getThreadPost(agent, parsedBody.uri);
                handle = post.author.handle.toString();
                images = extractImagesFromPost(post);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    logger.error(e.message);
                }
                return { success: false, error: 'BadRequest' };
            }
            logger.debug(`Post images extracted from ${parsedBody.uri}`);
        }

        {
            // OGP画像を生成してS3にアップロードする処理
            const imgsBuffer: Buffer[] = await Promise.all(
                images.map(async (img: { thumb: string }) => {
                    const res = await fetch(img.thumb);
                    if (!res.ok) {
                        throw new Error(`Failed to fetch image: ${res.status}`);
                    }
                    const ab = await res.arrayBuffer();
                    return Buffer.from(ab);
                }),
            );
            const ogpBuffer = await compositeImages(imgsBuffer);
            logger.debug(`Ogp generated: ${ogpBuffer.length} bytes`);

            const s3Client = new S3ClientWrapper();
            ogpUrl = await s3Client.uploadToS3({
                key: ogpKeyname,
                body: ogpBuffer,
                contentType: 'image/jpeg',
            });
            logger.debug(`Ogp uploaded: ${ogpKeyname}`);
        }

        const redisClient = new RedisClient();
        {
            // RedisにOGP情報を登録する処理
            await redisClient.addPage(dbKeyname, {
                ogp: ogpUrl,
                handle: handle,
                context: context === 'app.bsky.feed.post' ? undefined : context,
                imgs: images.map((img) => ({
                    thumb: img.thumb,
                    alt: img.alt,
                })),
            });
            logger.debug(`Ogp info added to Redis: ${dbKeyname}`);
        }

        return {
            success: true,
            data: {
                uri: dbKeyname,
                dbIndex: redisClient.redisIndex,
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

export default postOgp;
