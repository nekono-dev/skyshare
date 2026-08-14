import type { RouteHandler } from '@hono/zod-openapi';
import generateOgp from './post.service.js';
import route from './post.route.js';
import { logger } from '../../../common/logger.js';

const handler: RouteHandler<typeof route> = async (c) => {
    const body = c.req.valid('form');
    logger.debug('OGP Post Handler called');

    const result = await generateOgp(body);
    if (!result.success) {
        switch (result.error) {
            case 'BadRequest':
                return c.json({ error: 'BadRequest' }, 400);
            case 'Unauthorized':
                return c.json({ error: 'Unauthorized' }, 401);
            case 'InternalServerError':
            default:
                return c.json({ error: 'InternalServerError' }, 500);
        }
    }
    const { blob, contentType } = result.data;
    return new Response(blob, {
        headers: { 'Content-Type': contentType || 'application/octet-stream' },
    });
};

export default handler;
