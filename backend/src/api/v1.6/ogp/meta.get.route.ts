import { createRoute } from '@hono/zod-openapi';
import { RequestParamSchema, Response200Schema } from './meta.get.schema.js';
import { ResponseErrorSchema } from '../../error.schema.js';

const route = createRoute({
    path: '/meta',
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
            description: 'Ogb meta get successfully',
            content: {
                'application/json': {
                    schema: Response200Schema.openapi({
                        example: {
                            type: 'meta',
                            title: 'Sample Page Title',
                            description:
                                'This is a sample description for the page.',
                            image: 'https://example.com/ogp-image.jpg',
                        },
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
