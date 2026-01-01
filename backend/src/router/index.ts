import { ogpRouter } from './ogp.js';
import { createOpenApiHono } from '../common/client.js';

const appRouter = createOpenApiHono();

appRouter.route('/ogp', ogpRouter);

export { appRouter };
