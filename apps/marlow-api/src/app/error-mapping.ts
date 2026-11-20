import { GitHubPortError } from '@org/marlow-application';
import {
  ApiError,
  conflict,
  forbidden,
  internal,
  notFound,
  rateLimited,
  repoNotAllowed,
  unauthorized,
  upstreamUnavailable,
  validationFailed,
} from '@org/marlow-api-errors';
import { DomainError, Result } from '@org/marlow-domain';

/** Maps a domain failure (returned via Result) to a transport error. */
export const domainErrorToApiError = (error: DomainError): ApiError =>
  error.code === 'repo_not_allowed'
    ? repoNotAllowed(error.message)
    : validationFailed(error.message);

const apiErrorForGitHubKind = (error: GitHubPortError): ApiError => {
  switch (error.kind) {
    case 'unauthorized':
      return unauthorized('GitHub authentication failed');
    case 'forbidden':
      return forbidden('GitHub denied access to the resource');
    case 'not_found':
      return notFound('GitHub resource not found');
    case 'conflict':
      return conflict('GitHub resource is being modified by another request');
    case 'rate_limited':
      return rateLimited('GitHub rate limit exceeded');
    case 'validation_failed':
    case 'unprocessable':
      return validationFailed('GitHub rejected the request');
    case 'pending_review_exists':
      return conflict(
        'Authenticated GitHub user already has a pending review for this pull request',
      );
    case 'unavailable':
      return upstreamUnavailable();
    default:
      return internal();
  }
};

/**
 * Maps a GitHub port failure (thrown by the adapter) to a transport error.
 * GitHub's own `message` and `errors[]` ride along as public
 * `details.github`, so a caller can see which field GitHub rejected and why.
 */
export const githubErrorToApiError = (error: GitHubPortError): ApiError => {
  const apiError = apiErrorForGitHubKind(error);
  if (error.upstream === undefined) return apiError;
  return new ApiError(apiError.status, apiError.code, apiError.message, {
    details: { github: error.upstream },
    detailsVisibility: 'public',
  });
};

/** Returns the success value, or throws the mapped ApiError for the error handler. */
export const unwrapResult = <T>(result: Result<T, DomainError>): T => {
  if (!result.ok) throw domainErrorToApiError(result.error);
  return result.value;
};
