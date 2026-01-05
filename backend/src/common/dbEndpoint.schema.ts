import { z } from 'zod';

const DbEndpointRuleSchema = z.object({
    balancing: z
        .array(
            z.object({
                index: z.number().min(0),
                weight: z.number().min(0).optional().default(1),
                registerBlock: z
                    .object({
                        dateBefore: z.coerce.date().optional(),
                        dateAfter: z.coerce.date().optional(),
                    })
                    .optional(),
                migration: z
                    .object({
                        weight: z.number().min(0).default(1),
                        dateBefore: z.coerce.date().optional(),
                        dateAfter: z.coerce.date().optional(),
                    })
                    .optional(),
            })
        )
        .optional(),
});

type DbEndpointRule = z.infer<typeof DbEndpointRuleSchema>;

export { DbEndpointRuleSchema, type DbEndpointRule };
