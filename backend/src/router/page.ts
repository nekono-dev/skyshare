import { createOpenApiHono } from '../common/client.js';
import pageGetRouter from '../api/v1.6/page/get.route.js';
import pageGetHandler from '../api/v1.6/page/get.handler.js';

const pageRouter = createOpenApiHono();

pageRouter.openapi(pageGetRouter, pageGetHandler);
export { pageRouter };
