import { z } from '@hono/zod-openapi';

const RequestParamSchema = z.object({
    url: z.string(),
    lang: z.string(),
});

const Response200Schema = z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
});

type RequestParam = z.infer<typeof RequestParamSchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestParamSchema, Response200Schema };
export type { RequestParam, Response200 };
