import {
    type RequestParam,
    type Response200,
    RequestParamSchema,
} from './get.schema.js';

import { legacyDbEndpoint } from '../../../common/environments.js';
import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';

import { RedisClient } from '../../../lib/redis.js';
import { S3ClientWrapper } from '../../../lib/s3.js';

const getPage = async (
    requestBody: RequestParam
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedParam = RequestParamSchema.parse(requestBody);
        const dbKeyname = decodeURIComponent(parsedParam.dbKey);
        const dbIndex = parsedParam.dbIndex;
        const dbPlace = dbIndex;
        let redisClient = new RedisClient();

        if (dbPlace === 'legacy') {
            redisClient = new RedisClient({
                endpoint: legacyDbEndpoint,
            });
        } else {
            if (!Number.isInteger(Number(dbPlace))) {
                return {
                    success: false,
                    error: 'BadRequest',
                };
            }
            redisClient = new RedisClient({
                dbIndex: Number(dbPlace),
            });
        }
        logger.debug(`getPage dbKeyname: ${dbKeyname} dbIndex:${dbPlace}`);

        const dataBodyEncorded = await redisClient.getPage(dbKeyname);
        if (dataBodyEncorded === null || dataBodyEncorded === undefined) {
            // Not Found
            // legacyでなければS3から削除する
            if (dbPlace !== 'legacy') {
                const s3Client = new S3ClientWrapper();
                const ogpKeyname = dbKeyname.replace('@', '/') + '.jpg';
                await s3Client.deleteFromS3(ogpKeyname);
                logger.debug(`OGP file deleted from S3: ${ogpKeyname}`);
            }
            return {
                success: false,
                error: 'BadRequest',
            };
        }
        let handle: string = dataBodyEncorded.handle || '';
        if (dbPlace === 'legacy') {
            handle = dbKeyname.split('@')[0];
        }
        const ogpUrl = dataBodyEncorded.ogp;

        const responseData: Response200 = {
            ogp: ogpUrl,
            handle: handle,
            imgs: dataBodyEncorded.imgs,
        };
        logger.debug(`getPage responseData: ${JSON.stringify(responseData)}`);

        return {
            success: true,
            data: responseData,
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

export default getPage;
