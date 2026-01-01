import { z } from '@hono/zod-openapi';

const ResponseErrorSchema = z.object({
    error: z.string(),
});

type ResponseError = z.infer<typeof ResponseErrorSchema>;

export { ResponseErrorSchema };
export type { ResponseError };
