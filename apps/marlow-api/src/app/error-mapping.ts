import { GitHubPortError } from '@org/marlow-application';
import {
  ApiError,
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

/** Maps a GitHub port failure (thrown by the adapter) to a transport error. */
export const githubErrorToApiError = (error: GitHubPortError): ApiError => {
  switch (error.kind) {
    case 'unauthorized':
      return unauthorized('GitHub authentication failed');
    case 'forbidden':
      return forbidden('GitHub denied access to the resource');
    case 'not_found':
      return notFound('GitHub resource not found');
    case 'rate_limited':
      return rateLimited('GitHub rate limit exceeded');
    case 'validation_failed':
    case 'unprocessable':
      return validationFailed('GitHub rejected the request');
    case 'unavailable':
      return upstreamUnavailable();
    default:
      return internal();
  }
};

/** Returns the success value, or throws the mapped ApiError for the error handler. */
export const unwrapResult = <T>(result: Result<T, DomainError>): T => {
  if (!result.ok) throw domainErrorToApiError(result.error);
  return result.value;
};
