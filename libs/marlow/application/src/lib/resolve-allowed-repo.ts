import {
  DomainError,
  RepoRef,
  Result,
  assertRepoAllowed,
  createRepoRef,
} from '@org/marlow-domain';

/**
 * Validates `owner`/`repo` and enforces the allow-list in one step.
 *
 * Every repository-scoped use case calls this first, guaranteeing that a
 * disallowed repository is rejected before any GitHub-backed port is invoked.
 */
export const resolveAllowedRepo = (
  owner: string,
  repo: string,
): Result<RepoRef, DomainError> => {
  const ref = createRepoRef(owner, repo);
  if (!ref.ok) return ref;
  return assertRepoAllowed(ref.value);
};
