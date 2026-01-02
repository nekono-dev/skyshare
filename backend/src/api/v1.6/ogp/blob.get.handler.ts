import type { RouteHandler } from '@hono/zod-openapi';
import getOgp from './blob.get.service.js';
import route from './blob.get.route.js';
import { logger } from '../../../common/logger.js';

const handler: RouteHandler<typeof route> = async (c) => {
    const query = c.req.valid('query');
    logger.debug('OGP Get Handler called');

    const result = await getOgp(query);

    if (!result.success) {
        switch (result.error) {
            case 'InternalServerError':
            default:
                return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
    const { blob, contentType } = result.data;
    return new Response(blob, {
        headers: { 'Content-Type': contentType || 'application/octet-stream' },
    });
};

export default handler;
