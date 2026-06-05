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
  | 'rate_limited'
  | 'validation_failed'
  | 'unprocessable'
  | 'unavailable'
  | 'unknown';

export interface GitHubPortErrorOptions {
  readonly status?: number;
  readonly cause?: unknown;
}

/** The error contract thrown by {@link GitHubRepositoryPort} implementations. */
export class GitHubPortError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number | undefined;

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
  }
}

export const isGitHubPortError = (value: unknown): value is GitHubPortError =>
  value instanceof GitHubPortError;
