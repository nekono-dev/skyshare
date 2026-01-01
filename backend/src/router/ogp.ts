import { createOpenApiHono } from '../common/client.js';

import ogpPostRoute from '../api/ogp/post.route.js';
import ogpPostHandler from '../api/ogp/post.handler.js';

const ogpRouter = createOpenApiHono();
ogpRouter.openapi(ogpPostRoute, ogpPostHandler);

export { ogpRouter };
