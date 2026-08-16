import { createRoute } from '@hono/zod-openapi';
import { RequestParamSchema } from './blob.get.schema.js';
import { ResponseErrorSchema } from '../../error.schema.js';

const route = createRoute({
    path: '/blob',
    method: 'get',
    description: '作成したOGP画像を削除する。',
    tags: ['ogp'],
    //   security: [{ Bearer: [] }],
    request: {
        query: RequestParamSchema.openapi({
            example: {
                url: 'https://example.com/sample-page',
                lang: 'ja',
            },
        }),
    },
    responses: {
        200: {
            description: 'Ogb blob get successfully',
            content: {
                'image/*': {
                    schema: {
                        type: 'string',
                        format: 'binary',
                        example: '<binary stream>',
                    },
                },
            },
        },
        400: {
            description: 'Bad Request',
            content: {
                'application/json': {
                    schema: ResponseErrorSchema.openapi({
                        example: { error: 'BadRequest' },
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
