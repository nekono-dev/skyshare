import { createRoute } from '@hono/zod-openapi';
import { RequestParamSchema, Response200Schema } from './get.schema.js';
import { ResponseErrorSchema } from '../../error.schema.js';

const route = createRoute({
    path: '/{dbIndex}/{dbKey}',
    method: 'get',
    description: 'PageDBの情報を取得する。',
    tags: ['page'],
    //   security: [{ Bearer: [] }],
    request: {
        required: true,
        params: RequestParamSchema.openapi({
            example: {
                dbKey: '0/did:pls:XXXXXXX@YYYYYYYY.jpg',
                dbIndex: "0",
            },
        }),
    },
    responses: {
        200: {
            description: 'Db Record fetched successfully',
            content: {
                'application/json': {
                    schema: Response200Schema.openapi({
                        example: {
                            ogp: 'https://example.com/ogp.jpg',
                            context: 'app.bsky.feed.post',
                            imgs: [
                                {
                                    thumb: 'https://example.com/thumb1.jpg',
                                    alt: 'Image 1',
                                },
                                {
                                    thumb: 'https://example.com/thumb2.jpg',
                                    alt: 'Image 2',
                                },
                            ],
                        },
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
