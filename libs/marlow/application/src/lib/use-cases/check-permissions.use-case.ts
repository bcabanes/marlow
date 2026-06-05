import { DomainError, Result, ok } from '@org/marlow-domain';
import { PermissionCheck } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CheckPermissionsInput {
  readonly owner: string;
  readonly repo: string;
}

export const checkPermissions =
  (github: GitHubRepositoryPort) =>
  async (
    input: CheckPermissionsInput,
  ): Promise<Result<PermissionCheck, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    return ok(await github.checkPermissions(repo.value));
  };
