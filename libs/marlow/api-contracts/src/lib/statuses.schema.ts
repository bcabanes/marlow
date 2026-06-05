import { z } from 'zod';

/** Query identifying the ref (branch, tag, or sha) to inspect statuses for. */
export const statusRefQuerySchema = z.object({
  ref: z.string().min(1),
});
export type StatusRefQuery = z.infer<typeof statusRefQuerySchema>;
