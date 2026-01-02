import type { RouteHandler } from '@hono/zod-openapi';
import getPage from './get.service.js';
import route from './get.route.js';
import { logger } from '../../../common/logger.js';

const handler: RouteHandler<typeof route> = async (c) => {
    const params = c.req.valid('param');
    logger.debug('Page Get Handler called');

    const result = await getPage(params);
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
