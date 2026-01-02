import { createOpenApiHono } from '../common/client.js';
import pageGetRouter from '../api/v1.6/page/get.route.js';
import pageGetHandler from '../api/v1.6/page/get.handler.js';
import pagePostRoute from '../api/v1.6/page/post.route.js';
import pagePostHandler from '../api/v1.6/page/post.handler.js';
import pageDeleteRoute from '../api/v1.6/page/delete.route.js';
import pageDeleteHandler from '../api/v1.6/page/delete.handler.js';

const pageRouter = createOpenApiHono();

pageRouter.openapi(pageGetRouter, pageGetHandler);
pageRouter.openapi(pagePostRoute, pagePostHandler);
pageRouter.openapi(pageDeleteRoute, pageDeleteHandler);
export { pageRouter };
