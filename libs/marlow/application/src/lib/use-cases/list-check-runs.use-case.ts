import { DomainError, Result, createGitRef, ok } from '@org/marlow-domain';
import { CheckRun } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListCheckRunsInput {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
}

export const listCheckRuns =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListCheckRunsInput,
  ): Promise<Result<readonly CheckRun[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const ref = createGitRef(input.ref);
    if (!ref.ok) return ref;
    return ok(await github.listCheckRuns({ repo: repo.value, ref: ref.value }));
  };
