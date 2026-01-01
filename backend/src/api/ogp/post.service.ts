import type { RequestBody, Response200 } from './post.schema.js';
import { RequestBodySchema } from './post.schema.js';

import { atpService } from '../../common/environments.js';
import { logger } from '../../common/logger.js';
import type { ServiceResult } from '../../common/serviceResult.js';

import { Buffer } from 'buffer';
import { compositeImages } from '../../lib/ogp.js';
import { AtpAgent } from '@atproto/api';
import { getThreadPost, extractImagesFromPost } from '../../lib/bsky.js';
import uploadToS3 from '../../lib/s3.js';
import { addPage } from '../../lib/redis.js';

/* *
 * OGP画像を生成してS3にアップロードするメソッド
 * @param requestBody - リクエストボディ
 * @returns OGP画像のURIを含むレスポンス
 */
const postOgp = async (
    requestBody: RequestBody
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedBody = RequestBodySchema.parse(requestBody);

        const agent = new AtpAgent({
            service: atpService,
        });
        const did = parsedBody.uri.split('/')[2];
        const postId = parsedBody.uri.split('/')[4];
        const ogpKeyname = `${parsedBody.handle}/${postId}.jpg`;
        const dbKeyname = `${parsedBody.handle}@${postId}`;
        let images;
        let ogpUrl;

        {
            // Blueskyの投稿内容を取得する処理
            agent.sessionManager.session = {
                accessJwt: parsedBody.accessJwt,
                refreshJwt: '',
                handle: parsedBody.handle,
                did: did,
                active: true,
            };
            logger.debug(
                `Agent setup: ${parsedBody.handle} did: ${did} postId: ${postId}`
            );

            try {
                const post = await getThreadPost(agent, parsedBody.uri);
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
                })
            );
            const ogpBuffer = await compositeImages(imgsBuffer);
            logger.debug(`Ogp generated: ${ogpBuffer.length} bytes`);

            ogpUrl = await uploadToS3({
                key: ogpKeyname,
                body: ogpBuffer,
                contentType: 'image/jpeg',
            });
            logger.debug(`Ogp uploaded: ${ogpKeyname}`);
        }

        {
            // RedisにOGP情報を登録する処理
            await addPage(dbKeyname, {
                ogp: ogpUrl,
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
                uri: ogpKeyname,
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
