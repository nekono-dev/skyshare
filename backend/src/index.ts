import { getRequestListener } from '@hono/node-server';
import { onRequest } from 'firebase-functions/v2/https';
import { client } from './common/client.js';
import { serve } from '@hono/node-server';
import { launchEnv } from './common/environments.js';
import { appRouter } from './router/index.js';

client.route('/api', appRouter);

if (launchEnv === 'local') {
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
