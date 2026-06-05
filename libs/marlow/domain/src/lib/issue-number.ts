import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated GitHub issue number (positive integer). */
export type IssueNumber = number & { readonly __brand: 'IssueNumber' };

export const createIssueNumber = (
  value: number,
): Result<IssueNumber, DomainError> =>
  Number.isInteger(value) && value > 0
    ? ok(value as IssueNumber)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidIssueNumber,
          `Invalid issue number: ${value}`,
        ),
      );
