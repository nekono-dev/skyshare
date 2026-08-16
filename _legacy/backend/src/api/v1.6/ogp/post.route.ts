import { createRoute } from '@hono/zod-openapi';
import { RequestBodySchema } from './post.schema.js';
import { ResponseErrorSchema } from '../../error.schema.js';

const route = createRoute({
    path: '/',
    method: 'post',
    description:
        'クライアントが送信した画像群(最大4枚)からOGP画像を合成して返却する。投稿・アップロード等の副作用は行わない。有効なBlueskyのaccessJwtを持つリクエストのみ許可する。',
    tags: ['ogp'],
    request: {
        body: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: RequestBodySchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Ogp image generated successfully',
            content: {
                'image/jpeg': {
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
        401: {
            description: 'Unauthorized',
            content: {
                'application/json': {
                    schema: ResponseErrorSchema.openapi({
                        example: { error: 'Unauthorized' },
                    }),
                },
            },
        },
        500: {
            description: 'Internal server error',
            content: {
                'application/json': {
                    schema: ResponseErrorSchema.openapi({
                        example: { error: 'InternalServerError' },
                    }),
                },
            },
        },
    },
});

export default route;
