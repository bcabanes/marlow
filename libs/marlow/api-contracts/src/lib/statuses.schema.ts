import { z } from 'zod';
import { repoParamsSchema } from './common.schema.js';

/** Query identifying the ref (branch, tag, or sha) to inspect statuses for. */
export const statusRefQuerySchema = z.object({
  ref: z.string().min(1),
});
export type StatusRefQuery = z.infer<typeof statusRefQuerySchema>;

/** Path params identifying a check run: `/check-runs/:checkRunId`. */
export const checkRunParamsSchema = repoParamsSchema.extend({
  checkRunId: z.coerce.number().int().min(1),
});
export type CheckRunParams = z.infer<typeof checkRunParamsSchema>;
