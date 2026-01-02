import { createOpenApiHono } from '../common/client.js';

import ogpPostRoute from '../api/v1.6/ogp/post.route.js';
import ogpPostHandler from '../api/v1.6/ogp/post.handler.js';
import ogpDeleteRoute from '../api/v1.6/ogp/delete.route.js';
import ogpDeleteHandler from '../api/v1.6/ogp/delete.handler.js';

const ogpRouter = createOpenApiHono();
ogpRouter.openapi(ogpPostRoute, ogpPostHandler);
ogpRouter.openapi(ogpDeleteRoute, ogpDeleteHandler);

export { ogpRouter };
