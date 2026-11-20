import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { GitRef, createGitRef } from './git-ref.js';
import { Result, err, ok } from './result.js';

/** Two refs in one repository to compare, from GitHub's `BASE...HEAD` form. */
export interface CompareRange {
  readonly base: GitRef;
  readonly head: GitRef;
}

/**
 * Parses `BASE...HEAD`. A git ref cannot contain `..`, so the three-dot
 * separator is unambiguous; cross-repository `USER:BRANCH` sides are rejected
 * by the ref rules.
 */
export const createCompareRange = (
  basehead: string,
): Result<CompareRange, DomainError> => {
  const sides = basehead.split('...');
  if (sides.length !== 2) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidCompareRange,
        `Invalid compare range "${basehead}": expected BASE...HEAD`,
      ),
    );
  }
  const base = createGitRef(sides[0]);
  if (!base.ok) return base;
  const head = createGitRef(sides[1]);
  if (!head.ok) return head;
  return ok({ base: base.value, head: head.value });
};

export const compareRangeToString = (range: CompareRange): string =>
  `${range.base}...${range.head}`;
