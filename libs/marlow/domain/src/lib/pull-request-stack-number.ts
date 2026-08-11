import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated repository-scoped GitHub pull-request stack number. */
export type PullRequestStackNumber = number & {
  readonly __brand: 'PullRequestStackNumber';
};

export const createPullRequestStackNumber = (
  value: number,
): Result<PullRequestStackNumber, DomainError> =>
  Number.isInteger(value) && value > 0
    ? ok(value as PullRequestStackNumber)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidPullRequestStackNumber,
          `Invalid pull request stack number: ${value}`,
        ),
      );
