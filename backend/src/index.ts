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


if (launchEnv === undefined) {
    logger.error('LAUNCH_ENV is not defined');
    throw new Error('LAUNCH_ENV is not defined');
}
if (launchEnv === 'local') {
    logger.info('Starting server in local mode...');

    client.route('/skyshare-v1/asia-northeast1/firebaseAPI/api/v1', apiRouter);
    serve(
        {
            fetch: client.fetch,
            port: 5001,
            hostname: '0.0.0.0',
        },
        (info) => {
            console.log(`Server is running on http://0.0.0.0:${info.port}`);
        }
    );
}

client.route('/api/v1', apiRouter);

export const firebaseAPI = onRequest(
    {
        region: 'asia-northeast1',
    },
    getRequestListener(client.fetch)
);
