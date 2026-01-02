import { getRequestListener } from '@hono/node-server';
import { onRequest } from 'firebase-functions/v2/https';
import { client } from './common/client.js';
import { serve } from '@hono/node-server';
import { launchEnv } from './common/environments.js';

import { ogpRouter } from './router/ogp.js';
import { pageRouter } from './router/page.js';
import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from './common/logger.js';

const apiRouter = new OpenAPIHono();
apiRouter.route('/ogp', ogpRouter);
apiRouter.route('/page', pageRouter);

client.route('/api/v1', apiRouter);

if (launchEnv === undefined){
    logger.error('LAUNCH_ENV is not defined');
    throw new Error('LAUNCH_ENV is not defined');
}
if (launchEnv === 'local') {
    logger.info('Starting server in local mode...');
    serve(
        {
            fetch: client.fetch,
            port: 3000,
        },
        (info) => {
            console.log(`Server is running on http://localhost:${info.port}`);
        }
    );
}

export const firebaseAPI = onRequest(
    {
        region: 'asia-northeast1',
    },
    getRequestListener(client.fetch)
);
