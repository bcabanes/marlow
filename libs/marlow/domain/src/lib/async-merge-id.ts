import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated UUID returned by GitHub's asynchronous pull-request merge API. */
export type AsyncMergeId = string & { readonly __brand: 'AsyncMergeId' };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createAsyncMergeId = (
  value: string,
): Result<AsyncMergeId, DomainError> =>
  UUID_PATTERN.test(value)
    ? ok(value as AsyncMergeId)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidAsyncMergeId,
          'Invalid asynchronous merge ID',
        ),
      );
