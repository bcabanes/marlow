import { z } from 'zod';
import { paginationQuerySchema, repoParamsSchema } from './common.schema.js';

export const pullRequestStateSchema = z.enum(['open', 'closed', 'all']);

export const listPullRequestsQuerySchema = paginationQuerySchema.extend({
  state: pullRequestStateSchema.optional(),
});
export type ListPullRequestsQuery = z.infer<typeof listPullRequestsQuerySchema>;

export const pullNumberParamsSchema = repoParamsSchema.extend({
  pullNumber: z.coerce.number().int().min(1),
});
export type PullNumberParams = z.infer<typeof pullNumberParamsSchema>;

/** Path params identifying a label on a PR: `/pulls/:pullNumber/labels/:name`. */
export const pullLabelParamsSchema = pullNumberParamsSchema.extend({
  name: z.string().min(1),
});
export type PullLabelParams = z.infer<typeof pullLabelParamsSchema>;

/** Body for opening a pull request. Write endpoint: requires `confirm: true`. */
export const createPullRequestBodySchema = z.object({
  confirm: z.literal(true),
  title: z.string().min(1).max(256),
  head: z.string().min(1),
  base: z.string().min(1),
  body: z.string().max(65536).optional(),
  draft: z.boolean().optional(),
});
export type CreatePullRequestBody = z.infer<typeof createPullRequestBodySchema>;

/** Body for updating a pull request. Write endpoint: requires `confirm: true`. */
export const updatePullRequestBodySchema = z
  .object({
    confirm: z.literal(true),
    title: z.string().min(1).max(256).optional(),
    body: z.string().max(65536).optional(),
    base: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.body !== undefined ||
      value.base !== undefined,
    { message: 'Provide at least one of title, body, or base to update' },
  );
export type UpdatePullRequestBody = z.infer<typeof updatePullRequestBodySchema>;
