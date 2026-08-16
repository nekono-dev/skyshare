import { z } from '@hono/zod-openapi';

const RequestParamSchema = z.object({
    dbKey: z.string(),
    dbIndex: z.string(),
});

const Response200Schema = z.object({
    ogp: z.string(),
    handle: z.string(),
    imgs: z.array(
        z.object({
            thumb: z.string(),
            alt: z.string(),
        }),
    ),
});

type RequestParam = z.infer<typeof RequestParamSchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestParamSchema, Response200Schema };
export type { RequestParam, Response200 };
