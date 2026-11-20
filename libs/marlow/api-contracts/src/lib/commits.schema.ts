import { z } from 'zod';
import { paginationQuerySchema, repoParamsSchema } from './common.schema.js';

/**
 * Query for listing commits. `sha` is GitHub's name for the branch filter on
 * this endpoint; Marlow accepts it as an alias for `ref` so a guessed `?sha=`
 * is honored rather than silently dropped.
 */
export const listCommitsQuerySchema = paginationQuerySchema
  .extend({
    ref: z.string().min(1).optional(),
    sha: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
  })
  .refine((query) => query.ref === undefined || query.sha === undefined, {
    path: ['sha'],
    message: 'Provide ref or its alias sha, not both',
  })
  .transform(({ sha, ...query }) => ({ ...query, ref: query.ref ?? sha }));
export type ListCommitsQuery = z.infer<typeof listCommitsQuerySchema>;

export const commitShaParamsSchema = repoParamsSchema.extend({
  sha: z.string().min(1),
});
export type CommitShaParams = z.infer<typeof commitShaParamsSchema>;
