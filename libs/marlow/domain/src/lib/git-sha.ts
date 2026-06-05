import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated git object SHA (full 40-hex, or an abbreviated 7-40 hex prefix). */
export type GitSha = string & { readonly __brand: 'GitSha' };

const GIT_SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;

export const createGitSha = (value: string): Result<GitSha, DomainError> =>
  GIT_SHA_PATTERN.test(value)
    ? ok(value as GitSha)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.InvalidGitSha,
          `Invalid git SHA: "${value}"`,
        ),
      );
