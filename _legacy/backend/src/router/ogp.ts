import { createOpenApiHono } from '../common/client.js';
import ogpPostRoute from '../api/v1.6/ogp/post.route.js';
import ogpPostHandler from '../api/v1.6/ogp/post.handler.js';

const ogpRouter = createOpenApiHono();
ogpRouter.openapi(ogpPostRoute, ogpPostHandler);

export { ogpRouter };
