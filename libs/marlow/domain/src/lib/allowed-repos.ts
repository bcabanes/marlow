import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { RepoRef, repoRefToString } from './repo-ref.js';
import { Result, err, ok } from './result.js';

/** A repository Marlow is permitted to broker access to. */
export interface AllowedRepo {
  readonly owner: string;
  readonly repo: string;
}

/**
 * The complete, closed allow-list. This is Marlow's core security boundary:
 * any repository not present here must be rejected before GitHub is contacted.
 */
export const ALLOWED_REPOS: readonly AllowedRepo[] = [
  { owner: 'nrwl', repo: 'ocean' },
  { owner: 'nrwl', repo: 'nx' },
];

export const listAllowedRepos = (): readonly AllowedRepo[] => ALLOWED_REPOS;

export const isRepoAllowed = (ref: RepoRef): boolean =>
  ALLOWED_REPOS.some(
    (allowed) =>
      allowed.owner.toLowerCase() === ref.owner.toLowerCase() &&
      allowed.repo.toLowerCase() === ref.repo.toLowerCase(),
  );

/**
 * Returns the ref unchanged when it is allowed, or a `RepoNotAllowed` error.
 * Use cases MUST call this before invoking any GitHub-backed port method.
 */
export const assertRepoAllowed = (
  ref: RepoRef,
): Result<RepoRef, DomainError> =>
  isRepoAllowed(ref)
    ? ok(ref)
    : err(
        domainError(
          DOMAIN_ERROR_CODES.RepoNotAllowed,
          `Repository "${repoRefToString(ref)}" is not in the Marlow allow-list`,
        ),
      );
