import {
  GitHubErrorKind,
  GitHubPortError,
  GitHubUpstreamError,
  GitHubUpstreamErrorEntry,
} from '@org/marlow-application';
import { RequestError } from 'octokit';

const kindForStatus = (status: number): GitHubErrorKind => {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation_failed';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'unavailable' : 'unknown';
  }
};

// GitHub's GraphQL API answers HTTP 200 with typed errors in the body.
const KIND_FOR_GRAPHQL_ERROR_TYPE: Readonly<
  Partial<Record<string, GitHubErrorKind>>
> = {
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
};

// Classic, fine-grained, OAuth, user-to-server, server-to-server and refresh
// tokens. An error body should hold none, but it is untrusted text.
const GITHUB_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g;

const redactTokens = (value: string): string =>
  value.replace(GITHUB_TOKEN_PATTERN, '[redacted]');

const readString = (value: object, key: string): string | undefined => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? redactTokens(field) : undefined;
};

const parseUpstreamErrorEntry = (
  entry: unknown,
  codeKey: 'code' | 'type',
): readonly GitHubUpstreamErrorEntry[] => {
  if (typeof entry === 'string') return [{ message: redactTokens(entry) }];
  if (typeof entry !== 'object' || entry === null) return [];
  const resource = readString(entry, 'resource');
  const field = readString(entry, 'field');
  const code = readString(entry, codeKey);
  const message = readString(entry, 'message');
  return [
    {
      ...(resource === undefined ? {} : { resource }),
      ...(field === undefined ? {} : { field }),
      ...(code === undefined ? {} : { code }),
      ...(message === undefined ? {} : { message }),
    },
  ];
};

const parseUpstreamErrorEntries = (
  entries: unknown,
  codeKey: 'code' | 'type',
): readonly GitHubUpstreamErrorEntry[] =>
  Array.isArray(entries)
    ? entries.flatMap((entry) => parseUpstreamErrorEntry(entry, codeKey))
    : [];

/** Keeps only GitHub's top-level `message` and `errors[]` from a REST error body. */
const parseRestUpstreamError = (
  data: unknown,
): GitHubUpstreamError | undefined => {
  if (typeof data !== 'object' || data === null) return undefined;
  const message = readString(data, 'message') ?? null;
  const errors = parseUpstreamErrorEntries(Reflect.get(data, 'errors'), 'code');
  return message === null && errors.length === 0
    ? undefined
    : { message, errors };
};

const isPendingReviewConflict = (
  upstream: GitHubUpstreamError | undefined,
): boolean =>
  (upstream?.errors ?? []).some((entry) =>
    (entry.message ?? '')
      .toLowerCase()
      .includes('one pending review per pull request'),
  );

const mapRequestError = (error: RequestError): GitHubPortError => {
  const upstream = parseRestUpstreamError(error.response?.data);
  if (error.status === 422 && isPendingReviewConflict(upstream)) {
    return new GitHubPortError(
      'pending_review_exists',
      'GitHub rejected the review because a pending review already exists',
      { status: error.status, upstream },
    );
  }

  const remaining = error.response?.headers?.['x-ratelimit-remaining'];
  const isRateLimited =
    error.status === 429 || (error.status === 403 && remaining === '0');
  const kind = isRateLimited ? 'rate_limited' : kindForStatus(error.status);
  return new GitHubPortError(
    kind,
    `GitHub request failed (status ${error.status})`,
    { status: error.status, upstream },
  );
};

// `octokit` does not export `GraphqlResponseError`, so recognize it by shape.
const graphqlErrorEntries = (
  error: unknown,
): readonly GitHubUpstreamErrorEntry[] | undefined => {
  if (!(error instanceof Error) || error.name !== 'GraphqlResponseError') {
    return undefined;
  }
  return parseUpstreamErrorEntries(Reflect.get(error, 'errors'), 'type');
};

const mapGraphqlErrors = (
  errors: readonly GitHubUpstreamErrorEntry[],
): GitHubPortError => {
  const kind =
    KIND_FOR_GRAPHQL_ERROR_TYPE[errors[0]?.code ?? ''] ?? 'unprocessable';
  return new GitHubPortError(kind, 'GitHub GraphQL request failed', {
    upstream: { message: errors[0]?.message ?? null, errors },
  });
};

/**
 * Translates an arbitrary thrown value from the Octokit client into the
 * application's transport-neutral {@link GitHubPortError}. Raw provider errors
 * never escape the infrastructure layer: only GitHub's response-body `message`
 * and `errors[]` ride along, as `upstream`, never headers or the request.
 */
export const mapGitHubError = (error: unknown): GitHubPortError => {
  if (error instanceof GitHubPortError) return error;
  if (error instanceof RequestError) return mapRequestError(error);

  const graphqlErrors = graphqlErrorEntries(error);
  if (graphqlErrors !== undefined) return mapGraphqlErrors(graphqlErrors);

  return new GitHubPortError('unknown', 'Unexpected GitHub client error');
};
