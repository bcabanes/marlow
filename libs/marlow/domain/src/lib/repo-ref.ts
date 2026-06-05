import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/**
 * A validated reference to a GitHub repository (`owner/repo`).
 *
 * Construction enforces GitHub's naming rules but does NOT decide whether the
 * repository is accessible — that is the allow-list's responsibility
 * (see {@link ./allowed-repos.ts}).
 */
export interface RepoRef {
  readonly owner: string;
  readonly repo: string;
}

// GitHub login: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
// GitHub repo name: 1-100 chars from [A-Za-z0-9._-]; "." and ".." are reserved.
const REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export const createRepoRef = (
  owner: string,
  repo: string,
): Result<RepoRef, DomainError> => {
  if (!OWNER_PATTERN.test(owner)) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidRepoRef,
        `Invalid repository owner: "${owner}"`,
      ),
    );
  }
  if (repo === '.' || repo === '..' || !REPO_PATTERN.test(repo)) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidRepoRef,
        `Invalid repository name: "${repo}"`,
      ),
    );
  }
  return ok({ owner, repo });
};

export const repoRefToString = (ref: RepoRef): string =>
  `${ref.owner}/${ref.repo}`;
