import { DomainError, Result, ok } from '@org/marlow-domain';
import { PullRequest, PullRequestState } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListPullRequestsInput {
  readonly owner: string;
  readonly repo: string;
  readonly state?: PullRequestState;
  readonly page?: number;
  readonly perPage?: number;
}

export const listPullRequests =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListPullRequestsInput,
  ): Promise<Result<readonly PullRequest[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    return ok(
      await github.listPullRequests({
        repo: repo.value,
        state: input.state ?? 'open',
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
