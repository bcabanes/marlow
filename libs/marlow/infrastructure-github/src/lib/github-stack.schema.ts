import { GitHubPortError } from '@org/marlow-application';

type PullRequestState = 'open' | 'closed';
type MergeMethod = 'merge' | 'squash' | 'rebase';
type MergeAction = 'default' | 'direct_merge' | 'merge_queue';

interface GitHubStackSummaryEntry {
  readonly number: number;
  readonly state: PullRequestState;
  readonly draft: boolean;
  readonly merged_at: string | null;
  readonly head: { readonly ref: string; readonly sha: string };
}

interface GitHubStackEntry extends GitHubStackSummaryEntry {
  readonly id: number;
  readonly node_id: string;
  readonly title: string;
  readonly html_url: string;
  readonly user: { readonly login: string } | null;
  readonly url: string;
  readonly base: { readonly ref: string; readonly sha: string };
}

export interface GitHubPullRequestStackSummary {
  readonly id: number;
  readonly number: number;
  readonly node_id: string;
  readonly url: string;
  readonly base: { readonly ref: string };
  readonly open: boolean;
  readonly created_at: string;
  readonly pull_requests: readonly GitHubStackSummaryEntry[];
}

export interface GitHubPullRequestStack extends Omit<
  GitHubPullRequestStackSummary,
  'pull_requests'
> {
  readonly pull_requests: readonly GitHubStackEntry[];
}

export type GitHubAsyncMergeResult =
  | {
      readonly status: 'pending';
      readonly details: {
        readonly message: string;
        readonly uuid: string;
        readonly merge_method: MergeMethod;
        readonly merge_action: MergeAction;
        readonly expected_head_sha: string;
      };
    }
  | {
      readonly status: 'merged';
      readonly details: { readonly message: string; readonly sha: string };
    }
  | {
      readonly status: 'enqueued' | 'failed';
      readonly details: { readonly message: string };
    };

type UnknownObject = Record<string, unknown>;

const invalidPayload = (description: string): never => {
  throw new GitHubPortError(
    'unavailable',
    `GitHub returned an invalid ${description} payload`,
  );
};

const objectValue = (value: unknown, description: string): UnknownObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidPayload(description);
  }
  return value as UnknownObject;
};

const stringValue = (value: unknown, description: string): string =>
  typeof value === 'string' ? value : invalidPayload(description);

const nonEmptyStringValue = (value: unknown, description: string): string => {
  const result = stringValue(value, description);
  return result.length > 0 ? result : invalidPayload(description);
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidValue = (value: unknown, description: string): string => {
  const result = stringValue(value, description);
  return UUID_PATTERN.test(result) ? result : invalidPayload(description);
};

const positiveIntegerValue = (value: unknown, description: string): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : invalidPayload(description);

const booleanValue = (value: unknown, description: string): boolean =>
  typeof value === 'boolean' ? value : invalidPayload(description);

const nullableStringValue = (
  value: unknown,
  description: string,
): string | null => (value === null ? null : stringValue(value, description));

const pullRequestStateValue = (
  value: unknown,
  description: string,
): PullRequestState =>
  value === 'open' || value === 'closed' ? value : invalidPayload(description);

const parseStackSummaryEntry = (
  value: unknown,
  description: string,
): GitHubStackSummaryEntry => {
  const entry = objectValue(value, description);
  const head = objectValue(entry.head, description);
  return {
    number: positiveIntegerValue(entry.number, description),
    state: pullRequestStateValue(entry.state, description),
    draft: booleanValue(entry.draft, description),
    merged_at: nullableStringValue(entry.merged_at, description),
    head: {
      ref: stringValue(head.ref, description),
      sha: nonEmptyStringValue(head.sha, description),
    },
  };
};

const parseStackEntry = (
  value: unknown,
  description: string,
): GitHubStackEntry => {
  const entry = objectValue(value, description);
  const summary = parseStackSummaryEntry(entry, description);
  const base = objectValue(entry.base, description);
  const user =
    entry.user === null ? null : objectValue(entry.user, description);
  return {
    ...summary,
    id: positiveIntegerValue(entry.id, description),
    node_id: stringValue(entry.node_id, description),
    title: stringValue(entry.title, description),
    html_url: stringValue(entry.html_url, description),
    user:
      user === null ? null : { login: stringValue(user.login, description) },
    url: stringValue(entry.url, description),
    base: {
      ref: stringValue(base.ref, description),
      sha: nonEmptyStringValue(base.sha, description),
    },
  };
};

const parseStackBase = (
  value: unknown,
  description: string,
): Omit<GitHubPullRequestStackSummary, 'pull_requests'> => {
  const stack = objectValue(value, description);
  const base = objectValue(stack.base, description);
  return {
    id: positiveIntegerValue(stack.id, description),
    number: positiveIntegerValue(stack.number, description),
    node_id: stringValue(stack.node_id, description),
    url: stringValue(stack.url, description),
    base: { ref: stringValue(base.ref, description) },
    open: booleanValue(stack.open, description),
    created_at: stringValue(stack.created_at, description),
  };
};

const arrayValue = (value: unknown, description: string): readonly unknown[] =>
  Array.isArray(value) ? value : invalidPayload(description);

export const parsePullRequestStackSummaries = (
  value: unknown,
): readonly GitHubPullRequestStackSummary[] => {
  const description = 'pull request stack list';
  return arrayValue(value, description).map((item) => {
    const stack = objectValue(item, description);
    return {
      ...parseStackBase(stack, description),
      pull_requests: arrayValue(stack.pull_requests, description).map((entry) =>
        parseStackSummaryEntry(entry, description),
      ),
    };
  });
};

export const parsePullRequestStack = (
  value: unknown,
): GitHubPullRequestStack => {
  const description = 'pull request stack';
  const stack = objectValue(value, description);
  return {
    ...parseStackBase(stack, description),
    pull_requests: arrayValue(stack.pull_requests, description).map((entry) =>
      parseStackEntry(entry, description),
    ),
  };
};

const mergeMethodValue = (value: unknown): MergeMethod =>
  value === 'merge' || value === 'squash' || value === 'rebase'
    ? value
    : invalidPayload('asynchronous merge');

const mergeActionValue = (value: unknown): MergeAction =>
  value === 'default' || value === 'direct_merge' || value === 'merge_queue'
    ? value
    : invalidPayload('asynchronous merge');

export const parseAsyncMergeResult = (
  value: unknown,
): GitHubAsyncMergeResult => {
  const description = 'asynchronous merge';
  const result = objectValue(value, description);
  const details = objectValue(result.details, description);
  const message = stringValue(details.message, description);

  switch (result.status) {
    case 'pending':
      return {
        status: 'pending',
        details: {
          message,
          uuid: uuidValue(details.uuid, description),
          merge_method: mergeMethodValue(details.merge_method),
          merge_action: mergeActionValue(details.merge_action),
          expected_head_sha: nonEmptyStringValue(
            details.expected_head_sha,
            description,
          ),
        },
      };
    case 'merged':
      return {
        status: 'merged',
        details: {
          message,
          sha: nonEmptyStringValue(details.sha, description),
        },
      };
    case 'enqueued':
      return { status: 'enqueued', details: { message } };
    case 'failed':
      return { status: 'failed', details: { message } };
    default:
      return invalidPayload(description);
  }
};
