import { createRoute } from '@hono/zod-openapi';
import { RequestBodySchema, Response200Schema } from './delete.schema.js';
import { ResponseErrorSchema } from '../../error.schema.js';

const route = createRoute({
    path: '/',
    method: 'delete',
    description: '作成したOGP画像を削除する。',
    tags: ['ogp'],
    //   security: [{ Bearer: [] }],
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: RequestBodySchema.openapi({
                        example: {
                            pageId: 'v1.6/hashcode',
                            did: 'did:plc:quimkpbfh6mdasxs426v6ogy',
                            accessJwt: 'XXXXXXXXXXXXXXXXX',
                        },
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Page deleted successfully',
            content: {
                'application/json': {
                    schema: Response200Schema.openapi({
                        example: { result: 'ok' },
                    }),
                },
            },
        },
        400: {
            description: 'Bad request',
            content: {
                'application/json': {
                    schema: ResponseErrorSchema.openapi({
                        example: { error: 'Bad request' },
                    }),
                },
            },
        },
        500: {
            description: 'Internal server error',
            content: {
                'application/json': {
                    schema: ResponseErrorSchema.openapi({
                        example: { error: 'Internal Server Error' },
                    }),
                },
            },
        },
    },
});

export default route;
