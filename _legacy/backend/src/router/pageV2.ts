import { createOpenApiHono } from '../common/client.js';
import pageGetRouter from '../api/v1.6/page/get.route.js';
import pageGetHandler from '../api/v1.6/page/get.handler.js';
import pageDeleteRoute from '../api/v1.6/page/delete.route.js';
import pageDeleteHandler from '../api/v1.6/page/delete.handler.js';

const pageV2Router = createOpenApiHono();

pageV2Router.openapi(pageGetRouter, pageGetHandler);
pageV2Router.openapi(pageDeleteRoute, pageDeleteHandler);

export { pageV2Router };
