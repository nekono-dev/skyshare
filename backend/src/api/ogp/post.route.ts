import { createRoute } from '@hono/zod-openapi';
import { RequestBodySchema, Response200Schema } from './post.schema.js';
import { ResponseErrorSchema } from '../error.schema.js';

const route = createRoute({
    path: '/',
    method: 'post',
    description: 'Blueskyのポスト画像からOGPを生成する。',
    tags: ['ogp'],
    //   security: [{ Bearer: [] }],
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: RequestBodySchema.openapi({
                        example: {
                            uri: 'at://did:plc:quimkpbfh6mdasxs426v6ogy/app.bsky.feed.post/hashcode',
                            accessJwt: 'XXXXXXXXXXXXXXXXX',
                            handle: 'example.bsky.social',
                        },
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Page created successfully',
            content: {
                'application/json': {
                    schema: Response200Schema.openapi({
                        example: { uri: 'example.bsky.social/hashcode' },
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
