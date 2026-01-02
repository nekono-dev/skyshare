import { createOpenApiHono } from '../common/client.js';
import blobGetRouter from '../api/v1.6/ogp/blob.get.route.js';
import blobGetHandler from '../api/v1.6/ogp/blob.get.handler.js';

import metaGetRouter from '../api/v1.6/ogp/meta.get.route.js';
import metaGetHandler from '../api/v1.6/ogp/meta.get.handler.js';

const ogpRouter = createOpenApiHono();
ogpRouter.openapi(blobGetRouter, blobGetHandler);
ogpRouter.openapi(metaGetRouter, metaGetHandler);

export { ogpRouter };
