import { z } from 'zod';
import { paginationQuerySchema, repoParamsSchema } from './common.schema.js';

export const issueStateSchema = z.enum(['open', 'closed', 'all']);

export const listIssuesQuerySchema = paginationQuerySchema.extend({
  state: issueStateSchema.optional(),
});
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

export const issueNumberParamsSchema = repoParamsSchema.extend({
  issueNumber: z.coerce.number().int().min(1),
});
export type IssueNumberParams = z.infer<typeof issueNumberParamsSchema>;

/** Body for creating an issue. Write endpoint: requires `confirm: true`. */
export const createIssueBodySchema = z.object({
  confirm: z.literal(true),
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().min(1)).max(20).optional(),
});
export type CreateIssueBody = z.infer<typeof createIssueBodySchema>;

/** Body for commenting on an issue. Write endpoint: requires `confirm: true`. */
export const createIssueCommentBodySchema = z.object({
  confirm: z.literal(true),
  body: z.string().min(1).max(65536),
});
export type CreateIssueCommentBody = z.infer<
  typeof createIssueCommentBodySchema
>;

/** Body for editing an issue. Write endpoint: requires `confirm: true`. */
export const updateIssueBodySchema = z
  .object({
    confirm: z.literal(true),
    title: z.string().min(1).max(256).optional(),
    body: z.string().max(65536).optional(),
    state: z.enum(['open', 'closed']).optional(),
    stateReason: z.enum(['completed', 'not_planned', 'reopened']).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.body !== undefined ||
      value.state !== undefined ||
      value.stateReason !== undefined,
    {
      message:
        'Provide at least one of title, body, state, or stateReason to update',
    },
  );
export type UpdateIssueBody = z.infer<typeof updateIssueBodySchema>;

/** Path params identifying a label on an issue: `/issues/:issueNumber/labels/:name`. */
export const issueLabelParamsSchema = issueNumberParamsSchema.extend({
  name: z.string().min(1),
});
export type IssueLabelParams = z.infer<typeof issueLabelParamsSchema>;
