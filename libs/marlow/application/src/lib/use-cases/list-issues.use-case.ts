import { DomainError, Result, ok } from '@org/marlow-domain';
import { Issue, IssueState } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListIssuesInput {
  readonly owner: string;
  readonly repo: string;
  readonly state?: IssueState;
  readonly page?: number;
  readonly perPage?: number;
}

export const listIssues =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListIssuesInput,
  ): Promise<Result<readonly Issue[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    return ok(
      await github.listIssues({
        repo: repo.value,
        state: input.state ?? 'open',
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
