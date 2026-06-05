/**
 * Error codes for failures originating in the Marlow domain layer.
 *
 * These are transport-agnostic: the domain knows nothing about HTTP. The API
 * layer is responsible for translating a `DomainError` into a transport error.
 */
export const DOMAIN_ERROR_CODES = {
  RepoNotAllowed: 'repo_not_allowed',
  InvalidRepoRef: 'invalid_repo_ref',
  InvalidGitRef: 'invalid_git_ref',
  InvalidGitSha: 'invalid_git_sha',
  InvalidFilePath: 'invalid_file_path',
  InvalidIssueNumber: 'invalid_issue_number',
  InvalidPullRequestNumber: 'invalid_pull_request_number',
  InvalidSearchQuery: 'invalid_search_query',
} as const;

export type DomainErrorCode =
  (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES];

/** A structured, transport-agnostic domain failure. */
export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export const domainError = (
  code: DomainErrorCode,
  message: string,
): DomainError => ({ code, message });
