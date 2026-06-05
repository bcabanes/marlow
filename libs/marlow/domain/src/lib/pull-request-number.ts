import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated GitHub pull request number (positive integer). */
export type PullRequestNumber = number & {
  readonly __brand: 'PullRequestNumber';
};

export const createPullRequestNumber = (
  value: number,
): Result<PullRequestNumber, DomainError> =>
  Number.isInteger(value) && value > 0
    ? ok(value as PullRequestNumber)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidPullRequestNumber,
          `Invalid pull request number: ${value}`,
        ),
      );
