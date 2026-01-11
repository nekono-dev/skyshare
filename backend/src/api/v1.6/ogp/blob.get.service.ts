import {
    type RequestParam,
    RequestParamSchema,
    Response200,
} from './blob.get.schema.js';

import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';
import { isRequestURLInvalid, getUserAgent } from '../../../lib/url.js';

const getBlob = async (
    requestParam: RequestParam,
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedParam = RequestParamSchema.parse(requestParam);
        const validateParam = {
            lang: parsedParam.lang,
            url: decodeURIComponent(parsedParam.url),
        };

        if (isRequestURLInvalid({ url: validateParam.url })) {
            logger.debug('BadRequest: Invalid URL');
            return {
                success: false,
                error: 'BadRequest',
            };
        }
        const userAgent: string = getUserAgent(validateParam.url);
        const blob: Blob = await fetch(validateParam.url, {
            method: 'GET',
            headers: {
                'Accept-Language': validateParam.lang,
                'Cache-Control': 'no-cache',
                'User-Agent': userAgent,
            },
        }).then((res) => res.blob());
        logger.debug('Fetched OGP Blob successfully');
        return {
            success: true,
            data: {
                blob: blob,
                contentType: blob.type,
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

export default getBlob;
