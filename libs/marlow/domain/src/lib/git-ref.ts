import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated git reference (branch name, tag name, or symbolic ref). */
export type GitRef = string & { readonly __brand: 'GitRef' };

// A pragmatic subset of `git check-ref-format` rules, sufficient to keep
// obviously malformed or injection-prone refs out before they reach GitHub.
const isValidGitRef = (value: string): boolean => {
  if (value.length === 0 || value.length > 255) return false;
  if (value.startsWith('/') || value.endsWith('/')) return false;
  if (value.startsWith('.') || value.endsWith('.')) return false;
  if (value.endsWith('.lock')) return false;
  if (value === '@') return false;
  if (value.includes('..') || value.includes('//') || value.includes('@{')) {
    return false;
  }
  // Disallow whitespace, control characters, and the special chars ~ ^ : ? * [ \
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(value)) return false;
  return true;
};

export const createGitRef = (value: string): Result<GitRef, DomainError> =>
  isValidGitRef(value)
    ? ok(value as GitRef)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidGitRef,
          `Invalid git ref: "${value}"`,
        ),
      );
