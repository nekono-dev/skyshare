import { z } from '@hono/zod-openapi';

const RequestBodySchema = z.object({
    pageId: z.string(),
    did: z.string().optional(),
    accessJwt: z.string(),
});

const Response200Schema = z.object({
    result: z.string(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestBodySchema, Response200Schema };
export type { RequestBody, Response200 };
