import { z } from '@hono/zod-openapi';

const FileSchema = z.instanceof(File).openapi({
    type: 'string',
    format: 'binary',
});

const RequestBodySchema = z.object({
    accessJwt: z.string(),
    images: z.union([FileSchema, z.array(FileSchema)]).openapi({
        description: 'OGP画像に合成する元画像(1〜4枚)',
    }),
});

const Response200Schema = z.object({
    blob: z.any(),
    contentType: z.string().optional(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;
type Response200 = z.infer<typeof Response200Schema>;

export { RequestBodySchema, Response200Schema };
export type { RequestBody, Response200 };
