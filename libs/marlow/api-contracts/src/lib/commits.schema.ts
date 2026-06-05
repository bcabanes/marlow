import { z } from 'zod';
import { paginationQuerySchema, repoParamsSchema } from './common.schema.js';

export const listCommitsQuerySchema = paginationQuerySchema.extend({
  ref: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
});
export type ListCommitsQuery = z.infer<typeof listCommitsQuerySchema>;

export const commitShaParamsSchema = repoParamsSchema.extend({
  sha: z.string().min(1),
});
export type CommitShaParams = z.infer<typeof commitShaParamsSchema>;
