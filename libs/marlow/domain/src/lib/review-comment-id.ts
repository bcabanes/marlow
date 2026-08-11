import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated GitHub pull-request review-comment ID (positive integer). */
export type ReviewCommentId = number & {
  readonly __brand: 'ReviewCommentId';
};

export const createReviewCommentId = (
  value: number,
): Result<ReviewCommentId, DomainError> =>
  Number.isInteger(value) && value > 0
    ? ok(value as ReviewCommentId)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidReviewCommentId,
          `Invalid review comment ID: ${value}`,
        ),
      );
