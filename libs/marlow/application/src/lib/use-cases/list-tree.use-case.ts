import { DomainError, Result, createGitRef, ok } from '@org/marlow-domain';
import { TreeResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListTreeInput {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly recursive?: boolean;
}

export const listTree =
  (github: GitHubRepositoryPort) =>
  async (input: ListTreeInput): Promise<Result<TreeResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const ref = createGitRef(input.ref);
    if (!ref.ok) return ref;
    return ok(
      await github.listTree({
        repo: repo.value,
        ref: ref.value,
        recursive: input.recursive ?? false,
      }),
    );
  };
