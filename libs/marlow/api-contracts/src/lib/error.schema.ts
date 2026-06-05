import { z } from 'zod';

/** The JSON error body returned by every Marlow error response. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBodyDto = z.infer<typeof apiErrorBodySchema>;
