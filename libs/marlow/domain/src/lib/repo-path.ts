import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated, repo-relative file path (forward-slash separated, no traversal). */
export type FilePath = string & { readonly __brand: 'FilePath' };

const isValidFilePath = (value: string): boolean => {
  if (value.length === 0 || value.length > 4096) return false;
  if (value.startsWith('/')) return false;
  if (value.includes('\\') || value.includes('\0')) return false;
  // Reject empty, current-dir, and parent-dir segments (path traversal).
  return value
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    );
};

export const createFilePath = (value: string): Result<FilePath, DomainError> =>
  isValidFilePath(value)
    ? ok(value as FilePath)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidFilePath,
          `Invalid file path: "${value}"`,
        ),
      );
