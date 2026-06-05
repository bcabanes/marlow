import { DomainError, Result, createGitRef, ok } from '@org/marlow-domain';
import { CombinedStatus } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetCombinedStatusInput {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
}

export const getCombinedStatus =
  (github: GitHubRepositoryPort) =>
  async (
    input: GetCombinedStatusInput,
  ): Promise<Result<CombinedStatus, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const ref = createGitRef(input.ref);
    if (!ref.ok) return ref;
    return ok(
      await github.getCombinedStatus({ repo: repo.value, ref: ref.value }),
    );
  };
