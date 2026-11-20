/**
 * Transport-neutral failure categories for GitHub-backed port operations.
 *
 * Infrastructure adapters map provider-specific failures (e.g. Octokit
 * `RequestError`) onto this taxonomy, so the application and API layers never
 * depend on a concrete GitHub client.
 */
export type GitHubErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'validation_failed'
  | 'pending_review_exists'
  | 'unprocessable'
  | 'unavailable'
  | 'unknown';

/** One entry of GitHub's `errors[]` array; GitHub omits fields it has no value for. */
export interface GitHubUpstreamErrorEntry {
  readonly resource?: string;
  readonly field?: string;
  readonly code?: string;
  readonly message?: string;
}

/**
 * The client-safe part of a GitHub error body: its top-level `message` and its
 * `errors[]` entries. Adapters build it from the response body only, never from
 * headers, and redact anything shaped like a token.
 */
export interface GitHubUpstreamError {
  readonly message: string | null;
  readonly errors: readonly GitHubUpstreamErrorEntry[];
}

export interface GitHubPortErrorOptions {
  readonly status?: number;
  readonly upstream?: GitHubUpstreamError;
  readonly cause?: unknown;
}

/** The error contract thrown by {@link GitHubRepositoryPort} implementations. */
export class GitHubPortError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number | undefined;
  /** What GitHub said about the failure, when its response carried a body. */
  readonly upstream: GitHubUpstreamError | undefined;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    options: GitHubPortErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'GitHubPortError';
    this.kind = kind;
    this.status = options.status;
    this.upstream = options.upstream;
  }
}

export const isGitHubPortError = (value: unknown): value is GitHubPortError =>
  value instanceof GitHubPortError;
