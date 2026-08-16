import type { RequestBody, Response200 } from './post.schema.js';
import { RequestBodySchema } from './post.schema.js';

import { Buffer } from 'buffer';
import { compositeImages } from '../../../lib/ogp.js';
import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';
import { AtpAgent } from '@atproto/api';
import { atpService } from '../../../common/environments.js';

/**
 * accessJwtがBlueskyの有効なセッションのものかを検証する
 * @param accessJwt - 検証対象のアクセストークン
 * @returns 有効なセッションであればtrue
 */
const verifyAccessJwt = async (accessJwt: string): Promise<boolean> => {
    try {
        const agent = new AtpAgent({ service: atpService });
        agent.sessionManager.session = {
            accessJwt,
            refreshJwt: '',
            handle: '',
            did: '',
            active: true,
        };
        // トークンの有効性確認のみが目的の軽量な呼び出し
        await agent.com.atproto.server.getSession();
        return true;
    } catch (e: unknown) {
        logger.debug(`accessJwt verification failed: ${String(e)}`);
        return false;
    }
};

/**
 * クライアントから受け取った画像群からOGP画像を合成するメソッド
 * @param requestBody - リクエストボディ
 * @returns 合成したOGP画像のBlobを含むレスポンス
 */
const generateOgp = async (
    requestBody: RequestBody,
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedBody = RequestBodySchema.parse(requestBody);

        const isValidSession = await verifyAccessJwt(parsedBody.accessJwt);
        if (!isValidSession) {
            logger.debug('Unauthorized: invalid accessJwt');
            return { success: false, error: 'Unauthorized' };
        }

        const images = Array.isArray(parsedBody.images)
            ? parsedBody.images
            : [parsedBody.images];

        if (images.length === 0 || images.length > 4) {
            logger.debug(
                `BadRequest: images count out of range (${images.length})`,
            );
            return { success: false, error: 'BadRequest' };
        }

        const imgsBuffer: Buffer[] = await Promise.all(
            images.map(async (image) => {
                const ab = await image.arrayBuffer();
                return Buffer.from(ab);
            }),
        );
        const ogpBuffer = await compositeImages(imgsBuffer);
        logger.debug(`Ogp generated: ${ogpBuffer.length} bytes`);

        return {
            success: true,
            data: {
                blob: ogpBuffer,
                contentType: 'image/jpeg',
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

export default generateOgp;
