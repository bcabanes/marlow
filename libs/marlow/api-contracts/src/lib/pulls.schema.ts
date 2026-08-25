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

export const pullRequestStackParamsSchema = repoParamsSchema.extend({
  stackNumber: z.coerce.number().int().min(1),
});
export type PullRequestStackParams = z.infer<
  typeof pullRequestStackParamsSchema
>;

export const listPullRequestStacksQuerySchema = paginationQuerySchema.extend({
  pullNumber: z.coerce.number().int().min(1).optional(),
});
export type ListPullRequestStacksQuery = z.infer<
  typeof listPullRequestStacksQuerySchema
>;

export const pullRequestMergeResultParamsSchema = pullNumberParamsSchema.extend(
  {
    mergeId: z.string().uuid(),
  },
);
export type PullRequestMergeResultParams = z.infer<
  typeof pullRequestMergeResultParamsSchema
>;

export const pullReviewCommentParamsSchema = pullNumberParamsSchema.extend({
  commentId: z.coerce.number().int().min(1),
});
export type PullReviewCommentParams = z.infer<
  typeof pullReviewCommentParamsSchema
>;

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

const uniquePullRequestNumbers = (values: readonly number[]): boolean =>
  new Set(values).size === values.length;

/** Body for creating a stack; pull requests are ordered bottom to top. */
export const createPullRequestStackBodySchema = z
  .object({
    confirm: z.literal(true),
    pullNumbers: z.array(z.number().int().min(1)).min(2).max(100),
  })
  .strict()
  .refine((value) => uniquePullRequestNumbers(value.pullNumbers), {
    path: ['pullNumbers'],
    message: 'Pull request numbers must be unique',
  });
export type CreatePullRequestStackBody = z.infer<
  typeof createPullRequestStackBodySchema
>;

/** Body for appending pull requests above the current top of a stack. */
export const addPullRequestsToStackBodySchema = z
  .object({
    confirm: z.literal(true),
    pullNumbers: z.array(z.number().int().min(1)).min(1).max(100),
  })
  .strict()
  .refine((value) => uniquePullRequestNumbers(value.pullNumbers), {
    path: ['pullNumbers'],
    message: 'Pull request numbers must be unique',
  });
export type AddPullRequestsToStackBody = z.infer<
  typeof addPullRequestsToStackBodySchema
>;

export const mergePullRequestAsyncBodySchema = z
  .object({
    confirm: z.literal(true),
    mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional(),
    mergeAction: z.enum(['default', 'direct_merge', 'merge_queue']).optional(),
    commitTitle: z.string().min(1).max(256).optional(),
    commitMessage: z.string().max(65536).optional(),
    expectedHeadSha: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.mergeAction === 'merge_queue' &&
      (value.mergeMethod !== undefined ||
        value.commitTitle !== undefined ||
        value.commitMessage !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'mergeMethod, commitTitle, and commitMessage are not supported with mergeAction=merge_queue',
      });
    }
  });
export type MergePullRequestAsyncBody = z.infer<
  typeof mergePullRequestAsyncBodySchema
>;

/** Body for merging an entire remote stack using GitHub's async merge. */
export const mergePullRequestStackBodySchema = mergePullRequestAsyncBodySchema;
export type MergePullRequestStackBody = MergePullRequestAsyncBody;

export const reviewSideSchema = z.enum(['LEFT', 'RIGHT']);

const reviewCommentCommonShape = {
  confirm: z.literal(true),
  body: z.string().min(1).max(65536),
  commitId: z.string().min(1),
  path: z.string().min(1).max(4096),
};

const hasPairedRangeStart = (value: {
  readonly startLine?: number;
  readonly startSide?: 'LEFT' | 'RIGHT';
}): boolean =>
  (value.startLine === undefined) === (value.startSide === undefined);

const lineReviewCommentBodySchema = z
  .object({
    ...reviewCommentCommonShape,
    subjectType: z.literal('line').optional(),
    line: z.number().int().min(1),
    side: reviewSideSchema,
    startLine: z.number().int().min(1).optional(),
    startSide: reviewSideSchema.optional(),
  })
  .strict()
  .refine(hasPairedRangeStart, {
    message: 'startLine and startSide must be provided together',
  });

const fileReviewCommentBodySchema = z
  .object({
    ...reviewCommentCommonShape,
    subjectType: z.literal('file'),
  })
  .strict();

/** Body for an immediate review comment on a pull-request diff. */
export const createPullRequestReviewCommentBodySchema = z.union([
  lineReviewCommentBodySchema,
  fileReviewCommentBodySchema,
]);
export type CreatePullRequestReviewCommentBody = z.infer<
  typeof createPullRequestReviewCommentBodySchema
>;

/** Body for replying to a top-level pull-request review comment. */
export const createPullRequestReviewCommentReplyBodySchema = z
  .object({
    confirm: z.literal(true),
    body: z.string().min(1).max(65536),
  })
  .strict();
export type CreatePullRequestReviewCommentReplyBody = z.infer<
  typeof createPullRequestReviewCommentReplyBodySchema
>;

/** Review intent; PENDING or an omitted event creates an unsubmitted GitHub review. */
export const pullRequestReviewEventSchema = z.enum([
  'PENDING',
  'COMMENT',
  'APPROVE',
  'REQUEST_CHANGES',
]);

export const pullRequestReviewDraftCommentSchema = z
  .object({
    body: z.string().min(1).max(65536),
    path: z.string().min(1).max(4096),
    line: z.number().int().min(1),
    side: reviewSideSchema,
    startLine: z.number().int().min(1).optional(),
    startSide: reviewSideSchema.optional(),
  })
  .strict()
  .refine(hasPairedRangeStart, {
    message: 'startLine and startSide must be provided together',
  });
export type PullRequestReviewDraftComment = z.infer<
  typeof pullRequestReviewDraftCommentSchema
>;

/** Body for a pending or submitted pull-request review with optional inline comments. */
export const createPullRequestReviewBodySchema = z
  .object({
    confirm: z.literal(true),
    event: pullRequestReviewEventSchema.optional(),
    commitId: z.string().min(1).optional(),
    body: z.string().max(65536).optional(),
    comments: z.array(pullRequestReviewDraftCommentSchema).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.event === 'COMMENT' || value.event === 'REQUEST_CHANGES') &&
      (value.body === undefined || value.body.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['body'],
        message: `body is required when event is ${value.event}`,
      });
    }
  });
export type CreatePullRequestReviewBody = z.infer<
  typeof createPullRequestReviewBodySchema
>;
