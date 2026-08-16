import { z } from '@hono/zod-openapi';

const RequestParamSchema = z.object({
    url: z.string(),
    lang: z.string(),
});

const Response200Schema = z.object({
    blob: z.any(),
    contentType: z.string().optional(),
});

type RequestParam = z.infer<typeof RequestParamSchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestParamSchema, Response200Schema };
export type { RequestParam, Response200 };
