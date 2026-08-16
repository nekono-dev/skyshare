import { z } from '@hono/zod-openapi';

const RequestBodySchema = z.object({
    uri: z.string(),
    accessJwt: z.string(),
    handle: z.string().optional(),
});

const Response200Schema = z.object({
    uri: z.string(),
    dbIndex: z.number(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestBodySchema, Response200Schema };
export type { RequestBody, Response200 };
