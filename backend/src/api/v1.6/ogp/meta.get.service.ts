import {
    type RequestParam,
    RequestParamSchema,
    Response200,
} from './meta.get.schema.js';

import { logger } from '../../../common/logger.js';
import type { ServiceResult } from '../../../common/serviceResult.js';
import {
    isRequestURLInvalid,
    getUserAgent,
    findEncoding,
    unescapeHtml,
    extractHead,
} from '../../../lib/url.js';

const getMeta = async (
    requestParam: RequestParam
): Promise<ServiceResult<Response200>> => {
    try {
        const parsedParam = RequestParamSchema.parse(requestParam);
        const validateParam = {
            lang: parsedParam.lang,
            url: decodeURIComponent(parsedParam.url),
        };

        if (isRequestURLInvalid({ url: validateParam.url })) {
            logger.error('BadRequest: Invalid URL');
            return {
                success: false,
                error: 'BadRequest',
            };
        }
        const userAgent: string = getUserAgent(validateParam.url);

        const decodeAsText = async (arrayBuffer: Blob, encoding: string) =>
            new TextDecoder(encoding).decode(await arrayBuffer.arrayBuffer());

        const htmlBlob: Blob = await fetch(validateParam.url, {
            method: 'GET',
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': validateParam.lang,
                'Cache-Control': 'no-cache',
                'User-Agent': userAgent,
            },
        })
            .then((res) => res.blob())
            .catch((res: Error) => {
                const e: Error = new Error(res.message);
                e.name = res.name;
                throw e;
            });

        const encoding: string = await findEncoding(htmlBlob);
        const html: string = unescapeHtml(
            await decodeAsText(htmlBlob, encoding)
        );
        const meta = extractHead({ html })
        logger.debug(`Fetched OGP Meta: ${JSON.stringify(meta)}`);
        
        return {
            success: true,
            data: meta,
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

export default getMeta;
