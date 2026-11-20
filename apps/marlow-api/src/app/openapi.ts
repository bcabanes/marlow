import { API_ERROR_CODES } from '@org/marlow-api-errors';
import { ROUTE_ALIASES } from './route-aliases';

/**
 * OpenAPI 3.1 description of the Marlow HTTP API.
 *
 * The schema fragments below mirror the Zod request contracts in
 * `@org/marlow-api-contracts`. They are hand-authored: zod@4.4.3 ships no native
 * JSON Schema export, so there is no build-time conversion. `openapi.spec.ts`
 * asserts that the documented routes stay in lock-step with the routes the app
 * actually registers, which is the part most prone to drift.
 *
 * Parameters and request bodies are defined once under `components` and
 * referenced by `$ref` from each operation. This keeps the served document
 * small (owner/repo/issueNumber/pagination would otherwise be inlined dozens of
 * times) — the document is fetched into an LLM's context, so its size is a cost.
 *
 * The `endpoints` table, `parameters`, and `bodySchemas` are the single source
 * of truth: `buildOpenApiDocument` renders them as OpenAPI, and `cheatsheet.ts`
 * renders the same table as the terse agent cheat-sheet.
 *
 * OpenAPI 3.1 is aligned with JSON Schema 2020-12, so these fragments are valid
 * as-is. Most response bodies are deliberately open schemas because their DTOs
 * are TypeScript interfaces (not Zod). Responses with a public shape that needs
 * explicit documentation use `responseSchemas` below.
 */

type ParamLocation = 'path' | 'query';

export interface Parameter {
  readonly name: string;
  readonly in: ParamLocation;
  readonly required: boolean;
  readonly schema: unknown;
  readonly description?: string;
}

export interface BodySchema {
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly required: readonly string[];
  readonly description?: string;
  readonly properties: Record<string, unknown>;
  readonly oneOf?: readonly unknown[];
  readonly allOf?: readonly unknown[];
}

const param = (
  name: string,
  location: ParamLocation,
  required: boolean,
  schema: unknown,
  description?: string,
): Parameter => ({
  name,
  in: location,
  required,
  schema,
  ...(description ? { description } : {}),
});

// --- reusable schema fragments (mirror api-contracts) ---
const nonEmptyString = { type: 'string', minLength: 1 };
const positiveInt = { type: 'integer', minimum: 1 };
const perPageInt = { type: 'integer', minimum: 1, maximum: 100, default: 30 };
const stateSchema = { type: 'string', enum: ['open', 'closed', 'all'] };
const reviewSideSchema = { type: 'string', enum: ['LEFT', 'RIGHT'] };
const reviewBodySchema = { type: 'string', minLength: 1, maxLength: 65536 };
const rangeStartPairing = [
  {
    if: { required: ['startLine'] },
    then: { required: ['startSide'] },
  },
  {
    if: { required: ['startSide'] },
    then: { required: ['startLine'] },
  },
] as const;

// --- reusable parameters (referenced by $ref from each operation) ---
export const parameters = {
  owner: param('owner', 'path', true, nonEmptyString),
  repo: param('repo', 'path', true, nonEmptyString),
  issueNumber: param('issueNumber', 'path', true, positiveInt),
  pullNumber: param('pullNumber', 'path', true, positiveInt),
  stackNumber: param('stackNumber', 'path', true, positiveInt),
  mergeId: param('mergeId', 'path', true, { type: 'string', format: 'uuid' }),
  commentId: param('commentId', 'path', true, positiveInt),
  checkRunId: param('checkRunId', 'path', true, positiveInt),
  sha: param('sha', 'path', true, nonEmptyString),
  filePath: param(
    'path',
    'path',
    true,
    nonEmptyString,
    'File path within the repository; may contain slashes.',
  ),
  labelName: param(
    'name',
    'path',
    true,
    nonEmptyString,
    'Label name; URL-encode names that contain spaces.',
  ),
  page: param('page', 'query', false, positiveInt),
  perPage: param('perPage', 'query', false, perPageInt),
  state: param('state', 'query', false, stateSchema),
  pullNumberFilter: param(
    'pullNumber',
    'query',
    false,
    positiveInt,
    'Only return the stack containing this pull request.',
  ),
  refRequired: param(
    'ref',
    'query',
    true,
    nonEmptyString,
    'Branch, tag, or commit SHA.',
  ),
  refOptional: param(
    'ref',
    'query',
    false,
    nonEmptyString,
    'Branch, tag, or commit SHA.',
  ),
  recursive: param(
    'recursive',
    'query',
    false,
    { type: 'string', enum: ['true', 'false'] },
    'Recurse the full tree when "true".',
  ),
  searchQuery: param(
    'query',
    'query',
    true,
    nonEmptyString,
    'Code search terms. repo:/org:/user:/fork: qualifiers are rejected.',
  ),
  commitPath: param(
    'path',
    'query',
    false,
    nonEmptyString,
    'Only commits that touched this file or directory.',
  ),
  commitShaFilter: param(
    'sha',
    'query',
    false,
    nonEmptyString,
    "Alias for ref (GitHub's name for it). Send one, not both.",
  ),
  basehead: param(
    'basehead',
    'path',
    true,
    nonEmptyString,
    'BASE...HEAD, for example main...feat/x. Each side is a branch, tag, or SHA in this repository.',
  ),
} satisfies Record<string, Parameter>;

// --- request body schemas (mirror api-contracts), referenced by $ref ---
export const bodySchemas = {
  Confirm: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm'],
    properties: { confirm: { const: true } },
  },
  CreateIssue: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'title'],
    properties: {
      confirm: { const: true },
      title: { type: 'string', minLength: 1, maxLength: 256 },
      body: { type: 'string', maxLength: 65536 },
      labels: { type: 'array', items: nonEmptyString, maxItems: 20 },
    },
  },
  CreateIssueComment: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'body'],
    properties: {
      confirm: { const: true },
      body: { type: 'string', minLength: 1, maxLength: 65536 },
    },
  },
  CreatePullRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'title', 'head', 'base'],
    properties: {
      confirm: { const: true },
      title: { type: 'string', minLength: 1, maxLength: 256 },
      head: nonEmptyString,
      base: nonEmptyString,
      body: { type: 'string', maxLength: 65536 },
      draft: { type: 'boolean' },
    },
  },
  UpdatePullRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm'],
    description:
      'Provide at least one of title, body, base, or draft. draft=false marks a draft ready for review; draft=true converts it back to a draft. Requesting the current draft state changes nothing.',
    properties: {
      confirm: { const: true },
      title: { type: 'string', minLength: 1, maxLength: 256 },
      body: { type: 'string', maxLength: 65536 },
      base: nonEmptyString,
      draft: { type: 'boolean' },
    },
  },
  CreatePullRequestStack: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'pullNumbers'],
    description:
      'Pull request numbers must be unique and ordered from the bottom of the stack to the top.',
    properties: {
      confirm: { const: true },
      pullNumbers: {
        type: 'array',
        items: positiveInt,
        minItems: 2,
        maxItems: 100,
        uniqueItems: true,
      },
    },
  },
  AddPullRequestsToStack: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'pullNumbers'],
    description:
      'Pull request numbers to append, ordered from the current stack top upward.',
    properties: {
      confirm: { const: true },
      pullNumbers: {
        type: 'array',
        items: positiveInt,
        minItems: 1,
        maxItems: 100,
        uniqueItems: true,
      },
    },
  },
  MergePullRequestAsync: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm'],
    description:
      'Starts an atomic asynchronous merge. For a stacked PR, this merges every PR through the requested position. Poll the returned id while status=pending.',
    properties: {
      confirm: { const: true },
      mergeMethod: { type: 'string', enum: ['merge', 'squash', 'rebase'] },
      mergeAction: {
        type: 'string',
        enum: ['default', 'direct_merge', 'merge_queue'],
      },
      commitTitle: { type: 'string', minLength: 1, maxLength: 256 },
      commitMessage: { type: 'string', maxLength: 65536 },
      expectedHeadSha: nonEmptyString,
    },
  },
  CreatePullRequestReviewComment: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'body', 'commitId', 'path'],
    description:
      'Use line+side for a line target, optional paired startLine+startSide for a range, or subjectType=file without line fields.',
    properties: {
      confirm: { const: true },
      body: reviewBodySchema,
      commitId: nonEmptyString,
      path: { type: 'string', minLength: 1, maxLength: 4096 },
      subjectType: { type: 'string', enum: ['line', 'file'] },
      line: positiveInt,
      side: reviewSideSchema,
      startLine: positiveInt,
      startSide: reviewSideSchema,
    },
    oneOf: [
      {
        title: 'Line or range comment',
        required: ['line', 'side'],
        properties: { subjectType: { const: 'line' } },
        allOf: rangeStartPairing,
      },
      {
        title: 'File comment',
        required: ['subjectType'],
        properties: { subjectType: { const: 'file' } },
        not: {
          anyOf: [
            { required: ['line'] },
            { required: ['side'] },
            { required: ['startLine'] },
            { required: ['startSide'] },
          ],
        },
      },
    ],
  },
  CreatePullRequestReviewCommentReply: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'body'],
    properties: {
      confirm: { const: true },
      body: reviewBodySchema,
    },
  },
  CreatePullRequestReview: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm'],
    description:
      'Omitting event matches GitHub and creates an unsubmitted review; explicit PENDING is also accepted. Pending inline comments remain private and do not notify anyone until submission. COMMENT, APPROVE, and REQUEST_CHANGES submit immediately. body is required and non-empty for COMMENT and REQUEST_CHANGES. commitId is recommended when comments are present.',
    properties: {
      confirm: { const: true },
      event: {
        type: 'string',
        enum: ['PENDING', 'COMMENT', 'APPROVE', 'REQUEST_CHANGES'],
        description:
          "Optional. Omit this or use PENDING for an unsubmitted review. Marlow omits GitHub's event field in either case; every submitted-review value is forwarded unchanged.",
      },
      commitId: nonEmptyString,
      body: { type: 'string', maxLength: 65536 },
      comments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['body', 'path', 'line', 'side'],
          properties: {
            body: reviewBodySchema,
            path: { type: 'string', minLength: 1, maxLength: 4096 },
            line: positiveInt,
            side: reviewSideSchema,
            startLine: positiveInt,
            startSide: reviewSideSchema,
          },
          allOf: rangeStartPairing,
        },
      },
    },
    allOf: [
      {
        if: {
          properties: {
            event: { enum: ['COMMENT', 'REQUEST_CHANGES'] },
          },
          required: ['event'],
        },
        then: {
          required: ['body'],
          properties: { body: reviewBodySchema },
        },
      },
    ],
  },
  UpdateIssue: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm'],
    description: 'Provide at least one of title, body, state, or stateReason.',
    properties: {
      confirm: { const: true },
      title: { type: 'string', minLength: 1, maxLength: 256 },
      body: { type: 'string', maxLength: 65536 },
      state: { type: 'string', enum: ['open', 'closed'] },
      stateReason: {
        type: 'string',
        enum: ['completed', 'not_planned', 'reopened'],
      },
    },
  },
  AddLabels: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'labels'],
    properties: {
      confirm: { const: true },
      labels: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 50 },
        minItems: 1,
        maxItems: 20,
      },
    },
  },
  Assignees: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'assignees'],
    properties: {
      confirm: { const: true },
      assignees: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 39 },
        minItems: 1,
        maxItems: 10,
      },
    },
  },
  SetMilestone: {
    type: 'object',
    additionalProperties: false,
    required: ['confirm', 'milestone'],
    properties: {
      confirm: { const: true },
      milestone: { type: 'integer', minimum: 1 },
    },
  },
} satisfies Record<string, BodySchema>;

const responseSchemas = {
  PullRequestStackSummaryEntry: {
    type: 'object',
    additionalProperties: false,
    required: ['number', 'state', 'draft', 'mergedAt', 'headRef', 'headSha'],
    properties: {
      number: positiveInt,
      state: { type: 'string', enum: ['open', 'closed'] },
      draft: { type: 'boolean' },
      mergedAt: { type: ['string', 'null'], format: 'date-time' },
      headRef: { type: 'string' },
      headSha: nonEmptyString,
    },
  },
  PullRequestStackSummary: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'number',
      'nodeId',
      'url',
      'baseRef',
      'open',
      'createdAt',
      'pullRequests',
    ],
    properties: {
      id: positiveInt,
      number: positiveInt,
      nodeId: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      baseRef: { type: 'string' },
      open: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      pullRequests: {
        type: 'array',
        items: { $ref: '#/components/schemas/PullRequestStackSummaryEntry' },
      },
    },
  },
  PullRequestStackSummaryList: {
    type: 'array',
    items: { $ref: '#/components/schemas/PullRequestStackSummary' },
  },
  PullRequestStackEntry: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'nodeId',
      'title',
      'htmlUrl',
      'author',
      'number',
      'url',
      'state',
      'draft',
      'mergedAt',
      'headRef',
      'headSha',
      'baseRef',
      'baseSha',
    ],
    properties: {
      id: positiveInt,
      nodeId: { type: 'string' },
      title: { type: 'string' },
      htmlUrl: { type: 'string', format: 'uri' },
      author: { type: ['string', 'null'] },
      number: positiveInt,
      url: { type: 'string', format: 'uri' },
      state: { type: 'string', enum: ['open', 'closed'] },
      draft: { type: 'boolean' },
      mergedAt: { type: ['string', 'null'], format: 'date-time' },
      headRef: { type: 'string' },
      headSha: nonEmptyString,
      baseRef: { type: 'string' },
      baseSha: nonEmptyString,
    },
  },
  PullRequestStack: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'number',
      'nodeId',
      'url',
      'baseRef',
      'open',
      'createdAt',
      'pullRequests',
    ],
    properties: {
      id: positiveInt,
      number: positiveInt,
      nodeId: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      baseRef: { type: 'string' },
      open: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      pullRequests: {
        type: 'array',
        items: { $ref: '#/components/schemas/PullRequestStackEntry' },
      },
    },
  },
  AsyncMergePending: {
    type: 'object',
    additionalProperties: false,
    required: [
      'status',
      'message',
      'id',
      'mergeMethod',
      'mergeAction',
      'expectedHeadSha',
    ],
    properties: {
      status: { const: 'pending' },
      message: { type: 'string' },
      id: { type: 'string', format: 'uuid' },
      mergeMethod: { type: 'string', enum: ['merge', 'squash', 'rebase'] },
      mergeAction: {
        type: 'string',
        enum: ['default', 'direct_merge', 'merge_queue'],
      },
      expectedHeadSha: nonEmptyString,
    },
  },
  AsyncMergeMerged: {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'message', 'mergeCommitSha'],
    properties: {
      status: { const: 'merged' },
      message: { type: 'string' },
      mergeCommitSha: nonEmptyString,
    },
  },
  AsyncMergeEnqueued: {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'message'],
    properties: {
      status: { const: 'enqueued' },
      message: { type: 'string' },
    },
  },
  AsyncMergeFailed: {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'message'],
    properties: {
      status: { const: 'failed' },
      message: { type: 'string' },
    },
  },
  AsyncMergeResult: {
    oneOf: [
      { $ref: '#/components/schemas/AsyncMergePending' },
      { $ref: '#/components/schemas/AsyncMergeMerged' },
      { $ref: '#/components/schemas/AsyncMergeEnqueued' },
      { $ref: '#/components/schemas/AsyncMergeFailed' },
    ],
  },
  PollNextAction: {
    type: 'object',
    additionalProperties: false,
    required: ['method', 'url'],
    properties: {
      method: { const: 'GET' },
      url: { type: 'string' },
    },
  },
  AsyncMergeAccepted: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'merge', 'next'],
    properties: {
      outcome: { const: 'accepted' },
      merge: { $ref: '#/components/schemas/AsyncMergePending' },
      next: { $ref: '#/components/schemas/PollNextAction' },
    },
  },
  AsyncMergeCompleted: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'merge'],
    properties: {
      outcome: { const: 'completed' },
      merge: {
        oneOf: [
          { $ref: '#/components/schemas/AsyncMergeMerged' },
          { $ref: '#/components/schemas/AsyncMergeEnqueued' },
        ],
      },
    },
  },
  AsyncMergeRejected: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'merge'],
    properties: {
      outcome: { const: 'rejected' },
      merge: { $ref: '#/components/schemas/AsyncMergeFailed' },
    },
  },
  AsyncMergeAlreadyPending: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'merge', 'next'],
    properties: {
      outcome: { const: 'alreadyPending' },
      merge: { $ref: '#/components/schemas/AsyncMergePending' },
      next: { $ref: '#/components/schemas/PollNextAction' },
    },
  },
  PullRequestStackMergeComplete: {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'stackNumber', 'skippedMergedPullRequestNumbers'],
    properties: {
      outcome: { const: 'complete' },
      stackNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
    },
  },
  PullRequestStackMergeBlocked: {
    type: 'object',
    additionalProperties: false,
    required: [
      'outcome',
      'stackNumber',
      'skippedMergedPullRequestNumbers',
      'blocker',
    ],
    properties: {
      outcome: { const: 'blocked' },
      stackNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
      blocker: {
        type: 'object',
        additionalProperties: false,
        required: ['pullRequestNumber', 'reason'],
        properties: {
          pullRequestNumber: positiveInt,
          reason: { type: 'string', enum: ['draft', 'closed'] },
        },
      },
    },
  },
  PullRequestStackMergeAccepted: {
    type: 'object',
    additionalProperties: false,
    required: [
      'outcome',
      'stackNumber',
      'targetPullRequestNumber',
      'skippedMergedPullRequestNumbers',
      'submission',
      'next',
    ],
    properties: {
      outcome: { const: 'submitted' },
      stackNumber: positiveInt,
      targetPullRequestNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
      submission: { $ref: '#/components/schemas/AsyncMergeAccepted' },
      next: { $ref: '#/components/schemas/PollNextAction' },
    },
  },
  PullRequestStackMergeCompleted: {
    type: 'object',
    additionalProperties: false,
    required: [
      'outcome',
      'stackNumber',
      'targetPullRequestNumber',
      'skippedMergedPullRequestNumbers',
      'submission',
    ],
    properties: {
      outcome: { const: 'submitted' },
      stackNumber: positiveInt,
      targetPullRequestNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
      submission: { $ref: '#/components/schemas/AsyncMergeCompleted' },
    },
  },
  PullRequestStackMergeRejected: {
    type: 'object',
    additionalProperties: false,
    required: [
      'outcome',
      'stackNumber',
      'targetPullRequestNumber',
      'skippedMergedPullRequestNumbers',
      'submission',
    ],
    properties: {
      outcome: { const: 'submitted' },
      stackNumber: positiveInt,
      targetPullRequestNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
      submission: { $ref: '#/components/schemas/AsyncMergeRejected' },
    },
  },
  PullRequestStackMergeAlreadyPending: {
    type: 'object',
    additionalProperties: false,
    required: [
      'outcome',
      'stackNumber',
      'targetPullRequestNumber',
      'skippedMergedPullRequestNumbers',
      'submission',
      'next',
    ],
    properties: {
      outcome: { const: 'submitted' },
      stackNumber: positiveInt,
      targetPullRequestNumber: positiveInt,
      skippedMergedPullRequestNumbers: {
        type: 'array',
        items: positiveInt,
      },
      submission: { $ref: '#/components/schemas/AsyncMergeAlreadyPending' },
      next: { $ref: '#/components/schemas/PollNextAction' },
    },
  },
  PullRequestStackMergeOk: {
    oneOf: [
      { $ref: '#/components/schemas/PullRequestStackMergeComplete' },
      { $ref: '#/components/schemas/PullRequestStackMergeCompleted' },
    ],
  },
  PullRequestStackMergeConflict: {
    oneOf: [
      { $ref: '#/components/schemas/PullRequestStackMergeBlocked' },
      { $ref: '#/components/schemas/PullRequestStackMergeAlreadyPending' },
    ],
  },
  PullRequestReview: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'author', 'state', 'body', 'submittedAt', 'htmlUrl'],
    properties: {
      id: positiveInt,
      author: { type: ['string', 'null'] },
      state: {
        type: 'string',
        description:
          "PENDING for an unsubmitted review; otherwise GitHub's submitted review state.",
      },
      body: { type: ['string', 'null'] },
      submittedAt: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'Null while the review is pending.',
      },
      htmlUrl: {
        type: 'string',
        format: 'uri',
        description:
          'GitHub URL for inspecting, editing, and submitting the review in the pull-request interface.',
      },
    },
  },
  PullRequestFilePage: {
    type: 'object',
    additionalProperties: false,
    required: ['files', 'page', 'perPage', 'nextPage'],
    properties: {
      files: {
        type: 'array',
        maxItems: 100,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['filename', 'status', 'additions', 'deletions', 'changes'],
          properties: {
            filename: { type: 'string' },
            status: { type: 'string' },
            additions: { type: 'integer', minimum: 0 },
            deletions: { type: 'integer', minimum: 0 },
            changes: { type: 'integer', minimum: 0 },
          },
        },
      },
      page: positiveInt,
      perPage: { type: 'integer', minimum: 1, maximum: 100 },
      nextPage: {
        type: ['integer', 'null'],
        minimum: 2,
        description:
          'Send this as page to read the next page; null on the last page.',
      },
    },
  },
  CommitComparison: {
    type: 'object',
    additionalProperties: false,
    required: [
      'status',
      'aheadBy',
      'behindBy',
      'totalCommits',
      'commits',
      'files',
    ],
    properties: {
      status: {
        type: 'string',
        enum: ['diverged', 'ahead', 'behind', 'identical'],
      },
      aheadBy: { type: 'integer', minimum: 0 },
      behindBy: { type: 'integer', minimum: 0 },
      totalCommits: {
        type: 'integer',
        minimum: 0,
        description:
          'All commits head has that base lacks; page through them with page/perPage.',
      },
      commits: {
        type: 'array',
        maxItems: 100,
        description: 'This page of commits, oldest first, subject line only.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sha', 'messageHeadline', 'author', 'committer'],
          properties: {
            sha: nonEmptyString,
            messageHeadline: { type: 'string' },
            author: { $ref: '#/components/schemas/GitActor' },
            committer: { $ref: '#/components/schemas/GitActor' },
          },
        },
      },
      files: {
        type: 'array',
        maxItems: 300,
        description:
          'Changed files without patches. Only page 1 carries files; GitHub caps the list at 300.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['filename', 'status', 'additions', 'deletions', 'changes'],
          properties: {
            filename: { type: 'string' },
            status: { type: 'string' },
            additions: { type: 'integer', minimum: 0 },
            deletions: { type: 'integer', minimum: 0 },
            changes: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
  },
  GitActor: {
    oneOf: [
      { type: 'null' },
      {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'date'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          date: { type: 'string' },
        },
      },
    ],
  },
  CheckRun: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'name',
      'status',
      'conclusion',
      'app',
      'detailsUrl',
      'startedAt',
      'completedAt',
      'title',
      'summary',
      'summaryTruncated',
    ],
    properties: {
      id: positiveInt,
      name: { type: 'string' },
      status: { type: 'string' },
      conclusion: { type: ['string', 'null'] },
      app: {
        type: ['string', 'null'],
        description:
          'Slug of the GitHub App that owns the run; github-actions for Actions jobs.',
      },
      detailsUrl: { type: ['string', 'null'], format: 'uri' },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      title: { type: ['string', 'null'] },
      summary: {
        type: ['string', 'null'],
        maxLength: 2000,
        description: 'Output summary, cut to 2000 characters.',
      },
      summaryTruncated: {
        type: 'boolean',
        description: 'True when summary was cut short.',
      },
    },
  },
  CheckRunList: {
    type: 'array',
    items: { $ref: '#/components/schemas/CheckRun' },
  },
  CombinedStatus: {
    type: 'object',
    additionalProperties: false,
    required: ['state', 'totalCount', 'statuses'],
    properties: {
      state: { type: 'string' },
      totalCount: { type: 'integer', minimum: 0 },
      statuses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['context', 'state', 'description', 'targetUrl'],
          properties: {
            context: { type: 'string' },
            state: { type: 'string' },
            description: { type: ['string', 'null'] },
            targetUrl: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
  CheckRunRerun: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['via', 'checkRunId', 'jobId'],
        description:
          'A GitHub Actions run: Marlow called POST /actions/jobs/{jobId}/rerun, which also re-runs dependent jobs.',
        properties: {
          via: { const: 'actions_job_rerun' },
          checkRunId: positiveInt,
          jobId: positiveInt,
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['via', 'checkRunId', 'app'],
        description:
          'Any other app: Marlow called POST /check-runs/{checkRunId}/rerequest and the owning app decides whether to run again.',
        properties: {
          via: { const: 'check_run_rerequest' },
          checkRunId: positiveInt,
          app: { type: ['string', 'null'] },
        },
      },
    ],
  },
  PullRequestChecks: {
    type: 'object',
    additionalProperties: false,
    required: ['headSha', 'checkRuns', 'combinedStatus'],
    properties: {
      headSha: nonEmptyString,
      checkRuns: { $ref: '#/components/schemas/CheckRunList' },
      combinedStatus: { $ref: '#/components/schemas/CombinedStatus' },
    },
  },
} as const;

export interface Endpoint {
  readonly method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  readonly path: string;
  readonly tag: string;
  readonly operationId: string;
  readonly summary: string;
  readonly returns: string;
  readonly responseBody?: keyof typeof responseSchemas;
  readonly responses?: Readonly<
    Partial<
      Record<
        200 | 201 | 202 | 204 | 302 | 400 | 409,
        {
          readonly description: string;
          readonly responseBody?: keyof typeof responseSchemas | 'Error';
        }
      >
    >
  >;
  readonly params?: readonly (keyof typeof parameters)[];
  readonly body?: keyof typeof bodySchemas;
  readonly status?: 200 | 201;
  readonly write?: boolean;
}

// --- parameter groups (component names, not inline objects) ---
const repoParams = ['owner', 'repo'] as const;
const issueParams = [...repoParams, 'issueNumber'] as const;
const pullParams = [...repoParams, 'pullNumber'] as const;
const stackParams = [...repoParams, 'stackNumber'] as const;
const pagination = ['page', 'perPage'] as const;

export const endpoints: readonly Endpoint[] = [
  {
    method: 'get',
    path: '/',
    tag: 'meta',
    operationId: 'getRouteIndex',
    summary: 'Route index: this cheat-sheet as Markdown',
    returns: 'this cheat-sheet (text/markdown)',
    responses: {
      200: { description: 'The agent cheat-sheet, as text/markdown' },
    },
  },
  {
    method: 'get',
    path: '/openapi.json',
    tag: 'meta',
    operationId: 'getOpenApiDocument',
    summary: 'This OpenAPI 3.1 document',
    returns: 'OpenAPI 3.1 document',
  },
  {
    method: 'get',
    path: '/health',
    tag: 'meta',
    operationId: 'healthCheck',
    summary: 'Liveness check',
    returns: '{ "status": "ok" }',
  },
  ...ROUTE_ALIASES.map((alias): Endpoint => ({
    method: 'get',
    path: alias.path,
    tag: 'meta',
    operationId: alias.operationId,
    summary: `Redirects to ${alias.target}`,
    returns: `302 to ${alias.target}`,
    responses: { 302: { description: `Redirects to ${alias.target}` } },
  })),
  {
    method: 'get',
    path: '/repos',
    tag: 'repositories',
    operationId: 'listRepositories',
    summary: 'List the allow-listed repositories',
    returns: 'Repository[]',
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/permissions',
    tag: 'repositories',
    operationId: 'checkPermissions',
    summary: "Token's permission level on the repo",
    returns: 'PermissionCheck',
    params: repoParams,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/tree',
    tag: 'contents',
    operationId: 'listTree',
    summary: 'List the git tree at a ref',
    returns: 'TreeResult',
    params: [...repoParams, 'refRequired', 'recursive'],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/contents/{path}',
    tag: 'contents',
    operationId: 'getFileContents',
    summary: 'Read a file',
    returns: 'FileContents',
    params: [...repoParams, 'filePath', 'refOptional'],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/search/code',
    tag: 'contents',
    operationId: 'searchCode',
    summary: 'Search code within the repo',
    returns: 'CodeSearchResult',
    params: [...repoParams, 'searchQuery', ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/commits',
    tag: 'commits',
    operationId: 'listCommits',
    summary: 'List commits',
    returns: 'CommitListItem[]',
    params: [
      ...repoParams,
      'refOptional',
      'commitShaFilter',
      'commitPath',
      ...pagination,
    ],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/commits/{sha}',
    tag: 'commits',
    operationId: 'getCommit',
    summary: 'Get a commit with stats and files',
    returns: 'CommitDetail',
    params: [...repoParams, 'sha'],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/compare/{basehead}',
    tag: 'commits',
    operationId: 'compareCommits',
    summary:
      'Compare two refs: ahead/behind counts, one page of commits (oldest first), and changed files on page 1',
    returns: 'CommitComparison',
    responseBody: 'CommitComparison',
    params: [...repoParams, 'basehead', ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/issues',
    tag: 'issues',
    operationId: 'listIssues',
    summary: 'List issues',
    returns: 'IssueSummary[]',
    params: [...repoParams, 'state', ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}',
    tag: 'issues',
    operationId: 'getIssue',
    summary: 'Get an issue',
    returns: 'Issue',
    params: issueParams,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/issues',
    tag: 'issues',
    operationId: 'createIssue',
    summary: 'Create an issue',
    returns: 'Issue',
    params: repoParams,
    body: 'CreateIssue',
    status: 201,
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/close',
    tag: 'issues',
    operationId: 'closeIssue',
    summary: 'Close an issue',
    returns: 'Issue',
    params: issueParams,
    body: 'Confirm',
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/comments',
    tag: 'issues',
    operationId: 'listIssueComments',
    summary: 'List issue comments',
    returns: 'IssueComment[]',
    params: [...issueParams, ...pagination],
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/comments',
    tag: 'issues',
    operationId: 'createIssueComment',
    summary: 'Comment on an issue',
    returns: 'IssueComment',
    params: issueParams,
    body: 'CreateIssueComment',
    status: 201,
    write: true,
  },
  {
    method: 'patch',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}',
    tag: 'issues',
    operationId: 'updateIssue',
    summary: 'Edit an issue (title, body, state, stateReason)',
    returns: 'Issue',
    params: issueParams,
    body: 'UpdateIssue',
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/labels',
    tag: 'issues',
    operationId: 'addIssueLabels',
    summary: 'Add labels to an issue',
    returns: 'LabelSet',
    params: issueParams,
    body: 'AddLabels',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/labels/{name}',
    tag: 'issues',
    operationId: 'removeIssueLabel',
    summary: 'Remove a label from an issue',
    returns: 'LabelSet',
    params: [...issueParams, 'labelName'],
    body: 'Confirm',
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/assignees',
    tag: 'issues',
    operationId: 'addIssueAssignees',
    summary: 'Add assignees to an issue',
    returns: 'AssigneeSet',
    params: issueParams,
    body: 'Assignees',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/assignees',
    tag: 'issues',
    operationId: 'removeIssueAssignees',
    summary: 'Remove assignees from an issue',
    returns: 'AssigneeSet',
    params: issueParams,
    body: 'Assignees',
    write: true,
  },
  {
    method: 'put',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/milestone',
    tag: 'issues',
    operationId: 'setIssueMilestone',
    summary: 'Set an issue milestone',
    returns: 'MilestoneResult',
    params: issueParams,
    body: 'SetMilestone',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/issues/{issueNumber}/milestone',
    tag: 'issues',
    operationId: 'clearIssueMilestone',
    summary: 'Clear an issue milestone',
    returns: 'MilestoneResult',
    params: issueParams,
    body: 'Confirm',
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls',
    tag: 'pulls',
    operationId: 'listPullRequests',
    summary: 'List pull requests',
    returns: 'PullRequestSummary[]',
    params: [...repoParams, 'state', ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}',
    tag: 'pulls',
    operationId: 'getPullRequest',
    summary: 'Get a pull request',
    returns: 'PullRequest',
    params: pullParams,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls',
    tag: 'pulls',
    operationId: 'createPullRequest',
    summary: 'Open a pull request',
    returns: 'PullRequest',
    params: repoParams,
    body: 'CreatePullRequest',
    status: 201,
    write: true,
  },
  {
    method: 'put',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/merge-async',
    tag: 'pulls',
    operationId: 'mergePullRequestAsync',
    summary:
      'Atomically merge this pull request and any stacked pull requests below it',
    returns: 'AsyncMergeSubmission',
    params: pullParams,
    body: 'MergePullRequestAsync',
    responses: {
      200: {
        description: 'Already merged or enqueued',
        responseBody: 'AsyncMergeCompleted',
      },
      202: {
        description: 'Asynchronous merge accepted; poll next.url',
        responseBody: 'AsyncMergeAccepted',
      },
      400: {
        description: 'Pull request is not ready to merge',
        responseBody: 'AsyncMergeRejected',
      },
      409: {
        description: 'An asynchronous merge is already pending; poll next.url',
        responseBody: 'AsyncMergeAlreadyPending',
      },
    },
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/merge-async/{mergeId}',
    tag: 'pulls',
    operationId: 'getPullRequestMergeResult',
    summary: 'Poll an asynchronous pull-request merge',
    returns: 'AsyncMergeResult',
    responseBody: 'AsyncMergeResult',
    params: [...pullParams, 'mergeId'],
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/close',
    tag: 'pulls',
    operationId: 'closePullRequest',
    summary: 'Close a pull request',
    returns: 'PullRequest',
    params: pullParams,
    body: 'Confirm',
    write: true,
  },
  {
    method: 'patch',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}',
    tag: 'pulls',
    operationId: 'updatePullRequest',
    summary: 'Update a pull request (title, body, base, draft)',
    returns: 'PullRequest',
    params: pullParams,
    body: 'UpdatePullRequest',
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/files',
    tag: 'pulls',
    operationId: 'listPullRequestFiles',
    summary:
      'List one page of the files changed in a pull request; nextPage is null on the last page',
    returns: '{ files: PullRequestFile[], page, perPage, nextPage }',
    responseBody: 'PullRequestFilePage',
    params: [...pullParams, ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/commits',
    tag: 'pulls',
    operationId: 'listPullRequestCommits',
    summary: 'List the commits in a pull request',
    returns: 'CommitListItem[]',
    params: [...pullParams, ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/comments',
    tag: 'pulls',
    operationId: 'listPullRequestComments',
    summary:
      'List the review comments (inline, anchored to the diff) on a pull request',
    returns: 'ReviewComment[]',
    params: [...pullParams, ...pagination],
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/comments',
    tag: 'pulls',
    operationId: 'createPullRequestReviewComment',
    summary: 'Create an immediate line, range, or file review comment',
    returns: 'ReviewComment',
    params: pullParams,
    body: 'CreatePullRequestReviewComment',
    status: 201,
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/comments/{commentId}/replies',
    tag: 'pulls',
    operationId: 'createPullRequestReviewCommentReply',
    summary: 'Reply to a top-level pull-request review comment',
    returns: 'ReviewComment',
    params: [...pullParams, 'commentId'],
    body: 'CreatePullRequestReviewCommentReply',
    status: 201,
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/reviews',
    tag: 'pulls',
    operationId: 'listPullRequestReviews',
    summary: 'List the reviews (verdicts) on a pull request',
    returns: 'PullRequestReview[]',
    params: [...pullParams, ...pagination],
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/reviews',
    tag: 'pulls',
    operationId: 'createPullRequestReview',
    summary:
      'Create a pending or submitted pull-request review with optional inline comments',
    returns: 'PullRequestReview',
    responseBody: 'PullRequestReview',
    params: pullParams,
    body: 'CreatePullRequestReview',
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/labels',
    tag: 'pulls',
    operationId: 'addPullRequestLabels',
    summary: 'Add labels to a pull request',
    returns: 'LabelSet',
    params: pullParams,
    body: 'AddLabels',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/labels/{name}',
    tag: 'pulls',
    operationId: 'removePullRequestLabel',
    summary: 'Remove a label from a pull request',
    returns: 'LabelSet',
    params: [...pullParams, 'labelName'],
    body: 'Confirm',
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/assignees',
    tag: 'pulls',
    operationId: 'addPullRequestAssignees',
    summary: 'Add assignees to a pull request',
    returns: 'AssigneeSet',
    params: pullParams,
    body: 'Assignees',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/assignees',
    tag: 'pulls',
    operationId: 'removePullRequestAssignees',
    summary: 'Remove assignees from a pull request',
    returns: 'AssigneeSet',
    params: pullParams,
    body: 'Assignees',
    write: true,
  },
  {
    method: 'put',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/milestone',
    tag: 'pulls',
    operationId: 'setPullRequestMilestone',
    summary: 'Set a pull request milestone',
    returns: 'MilestoneResult',
    params: pullParams,
    body: 'SetMilestone',
    write: true,
  },
  {
    method: 'delete',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/milestone',
    tag: 'pulls',
    operationId: 'clearPullRequestMilestone',
    summary: 'Clear a pull request milestone',
    returns: 'MilestoneResult',
    params: pullParams,
    body: 'Confirm',
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/stacks',
    tag: 'stacks',
    operationId: 'listPullRequestStacks',
    summary: 'List pull-request stacks',
    returns: 'PullRequestStackSummary[]',
    responseBody: 'PullRequestStackSummaryList',
    params: [...repoParams, 'pullNumberFilter', ...pagination],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/stacks/{stackNumber}',
    tag: 'stacks',
    operationId: 'getPullRequestStack',
    summary: 'Get a pull-request stack',
    returns: 'PullRequestStack',
    responseBody: 'PullRequestStack',
    params: stackParams,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/stacks',
    tag: 'stacks',
    operationId: 'createPullRequestStack',
    summary: 'Link an ordered pull-request chain as a stack',
    returns: 'PullRequestStack',
    params: repoParams,
    body: 'CreatePullRequestStack',
    status: 201,
    responseBody: 'PullRequestStack',
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/stacks/{stackNumber}/add',
    tag: 'stacks',
    operationId: 'addPullRequestsToStack',
    summary: 'Append pull requests to the top of a stack',
    returns: 'PullRequestStack',
    params: stackParams,
    body: 'AddPullRequestsToStack',
    responses: {
      200: {
        description: 'Updated pull-request stack',
        responseBody: 'PullRequestStack',
      },
      409: {
        description: 'The stack is being modified by another request',
        responseBody: 'Error',
      },
    },
    write: true,
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/stacks/{stackNumber}/unstack',
    tag: 'stacks',
    operationId: 'unstackPullRequests',
    summary: 'Remove eligible pull requests from a stack',
    returns: 'PullRequestStack | no content',
    params: stackParams,
    body: 'Confirm',
    responses: {
      200: {
        description: 'Pull requests remain in the updated stack',
        responseBody: 'PullRequestStack',
      },
      204: { description: 'The stack was dissolved' },
      409: {
        description: 'The stack is being modified by another request',
        responseBody: 'Error',
      },
    },
    write: true,
  },
  {
    method: 'put',
    path: '/repos/{owner}/{repo}/stacks/{stackNumber}/merge-async',
    tag: 'stacks',
    operationId: 'mergePullRequestStack',
    summary: 'Merge the whole stack using GitHub atomic stack merge',
    returns: 'PullRequestStackMergeResult',
    params: stackParams,
    body: 'MergePullRequestAsync',
    responses: {
      200: {
        description: 'Stack already complete, merged immediately, or enqueued',
        responseBody: 'PullRequestStackMergeOk',
      },
      202: {
        description: 'Stack merge accepted; poll next.url',
        responseBody: 'PullRequestStackMergeAccepted',
      },
      400: {
        description: 'GitHub rejected the selected stack merge target',
        responseBody: 'PullRequestStackMergeRejected',
      },
      409: {
        description:
          'The stack is blocked or its selected pull request already has a merge pending',
        responseBody: 'PullRequestStackMergeConflict',
      },
    },
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/commit-status',
    tag: 'statuses',
    operationId: 'getCombinedStatus',
    summary: 'Combined commit status for a ref',
    returns: 'CombinedStatus',
    responseBody: 'CombinedStatus',
    params: [...repoParams, 'refRequired'],
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/check-runs',
    tag: 'checks',
    operationId: 'listCheckRuns',
    summary: 'Check runs for a ref',
    returns: 'CheckRun[]',
    responseBody: 'CheckRunList',
    params: [...repoParams, 'refRequired'],
  },
  {
    method: 'post',
    path: '/repos/{owner}/{repo}/check-runs/{checkRunId}/rerequest',
    tag: 'checks',
    operationId: 'rerunCheckRun',
    summary:
      'Run a check again: re-runs a GitHub Actions job, or rerequests a check run owned by another app',
    returns: 'CheckRunRerun',
    responseBody: 'CheckRunRerun',
    params: [...repoParams, 'checkRunId'],
    body: 'Confirm',
    write: true,
  },
  {
    method: 'get',
    path: '/repos/{owner}/{repo}/pulls/{pullNumber}/checks',
    tag: 'checks',
    operationId: 'getPullRequestChecks',
    summary:
      "Check runs and combined status for a pull request's current head commit",
    returns: '{ headSha, checkRuns: CheckRun[], combinedStatus }',
    responseBody: 'PullRequestChecks',
    params: pullParams,
  },
];

const operation = (endpoint: Endpoint): Record<string, unknown> => ({
  tags: [endpoint.tag],
  operationId: endpoint.operationId,
  summary: endpoint.summary,
  ...(endpoint.write
    ? {
        description:
          'Write endpoint — requires `{ "confirm": true }` in the body.',
      }
    : {}),
  ...(endpoint.params && endpoint.params.length
    ? {
        parameters: endpoint.params.map((name) => ({
          $ref: `#/components/parameters/${name}`,
        })),
      }
    : {}),
  ...(endpoint.body
    ? {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${endpoint.body}` },
            },
          },
        },
      }
    : {}),
  responses: {
    ...(endpoint.responses
      ? Object.fromEntries(
          Object.entries(endpoint.responses).map(([status, response]) => [
            status,
            {
              description: response.description,
              ...(response.responseBody
                ? {
                    content: {
                      'application/json': {
                        schema: {
                          $ref: `#/components/schemas/${response.responseBody}`,
                        },
                      },
                    },
                  }
                : {}),
            },
          ]),
        )
      : {
          [String(endpoint.status ?? 200)]: {
            description: endpoint.returns,
            content: {
              'application/json': {
                schema: endpoint.responseBody
                  ? { $ref: `#/components/schemas/${endpoint.responseBody}` }
                  : {},
              },
            },
          },
        }),
    default: { $ref: '#/components/responses/Error' },
  },
});

/** Build the OpenAPI 3.1 document describing every Marlow route. */
export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    (paths[endpoint.path] ??= {})[endpoint.method] = operation(endpoint);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Marlow',
      version: '0.0.1',
      description:
        'Local GitHub API broker — least-privilege access to an allow-listed set of private repositories. Repository routes only succeed for allow-listed repositories; write endpoints require `{ "confirm": true }`; every error shares the Error shape.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'meta' },
      { name: 'repositories' },
      { name: 'contents' },
      { name: 'commits' },
      { name: 'issues' },
      { name: 'pulls' },
      { name: 'stacks' },
      { name: 'statuses' },
      { name: 'checks' },
    ],
    paths,
    components: {
      parameters,
      schemas: {
        Error: {
          type: 'object',
          additionalProperties: false,
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: Object.values(API_ERROR_CODES) },
                message: { type: 'string' },
                details: {},
              },
            },
          },
        },
        ...responseSchemas,
        ...bodySchemas,
      },
      responses: {
        Error: {
          description: 'Error response',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  };
};
