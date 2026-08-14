import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from './logger.js';
import { launchEnv, serviceUrl } from './environments.js';

const createOpenApiHono = () =>
    new OpenAPIHono({
        strict: false,
        defaultHook: (result) => {
            if (!result.success) {
                if (result.error.name === 'ZodError') {
                    logger.error(
                        `Validation error: ${JSON.stringify(
                            result.error.issues,
                        )}`,
                    );
                    throw new HTTPException(400, {
                        res: new Response(
                            JSON.stringify({ error: 'InvalidRequest' }),
                            {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        ),
                    });
                }
                throw new HTTPException(500, {
                    res: new Response(
                        JSON.stringify({ error: 'InternalServerError' }),
                        {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    ),
                });
            }
        },
    });

const client = createOpenApiHono();

let origin = '*';
if (launchEnv !== 'local') {
    origin = serviceUrl;
}

// CORS対応
client.use('/*', cors());
client.use(
    '/*',
    cors({
        origin: origin,
        allowHeaders: ['Content-Type', 'Authorization'],
    }),
);
// APIドキュメントを出力
if (launchEnv === 'local') {
    client
        .doc('/openapi.json', {
            openapi: '3.0.0',
            info: {
                title: 'Skyshare backend API',
                version: '1.0.0',
            },
        })
        // swagger側は相対パス
        .get('/doc', swaggerUI({ url: './openapi.json' }));
}

client.notFound((c) => {
    return c.json({ error: 'BadRequest' }, 400);
});
export { client, createOpenApiHono };
