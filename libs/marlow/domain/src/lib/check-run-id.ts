import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated GitHub check-run ID (positive integer). */
export type CheckRunId = number & { readonly __brand: 'CheckRunId' };

export const createCheckRunId = (
  value: number,
): Result<CheckRunId, DomainError> =>
  Number.isInteger(value) && value > 0
    ? ok(value as CheckRunId)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidCheckRunId,
          `Invalid check run ID: ${value}`,
        ),
      );
