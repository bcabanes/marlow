import { GitHubErrorKind, GitHubPortError } from '@org/marlow-application';
import { RequestError } from 'octokit';

const kindForStatus = (status: number): GitHubErrorKind => {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 422:
      return 'validation_failed';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'unavailable' : 'unknown';
  }
};

const hasExistingPendingReviewError = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null) return false;
  const errors = (data as { readonly errors?: unknown }).errors;
  if (!Array.isArray(errors)) return false;

  return errors.some((error) => {
    if (typeof error !== 'object' || error === null) return false;
    const message = (error as { readonly message?: unknown }).message;
    return (
      typeof message === 'string' &&
      message.toLowerCase().includes('one pending review per pull request')
    );
  });
};

/**
 * Translates an arbitrary thrown value from the Octokit client into the
 * application's transport-neutral {@link GitHubPortError}. Raw provider errors
 * never escape the infrastructure layer.
 */
export const mapGitHubError = (error: unknown): GitHubPortError => {
  if (error instanceof GitHubPortError) return error;

  if (error instanceof RequestError) {
    if (
      error.status === 422 &&
      hasExistingPendingReviewError(error.response?.data)
    ) {
      return new GitHubPortError(
        'pending_review_exists',
        'GitHub rejected the review because a pending review already exists',
        { status: error.status },
      );
    }

    const remaining = error.response?.headers?.['x-ratelimit-remaining'];
    const isRateLimited =
      error.status === 429 || (error.status === 403 && remaining === '0');
    const kind = isRateLimited ? 'rate_limited' : kindForStatus(error.status);
    return new GitHubPortError(
      kind,
      `GitHub request failed (status ${error.status})`,
      { status: error.status },
    );
  }

  return new GitHubPortError('unknown', 'Unexpected GitHub client error');
};
