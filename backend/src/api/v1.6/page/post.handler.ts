import type { RouteHandler } from '@hono/zod-openapi';
import postOgp from './post.service.js';
import route from './post.route.js';
import { logger } from '../../../common/logger.js';

const handler: RouteHandler<typeof route> = async (c) => {
    const body = c.req.valid('json');
    logger.debug("Page Post Handler called");

    const result = await postOgp(body);
    if (!result.success) {
        switch (result.error) {
            case 'BadRequest':
                return c.json({ error: 'BadRequest' }, 400);
            case 'InternalServerError':
            default:
                return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
    return c.json(result.data, 200);
};

export default handler;
