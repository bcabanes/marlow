import {
  DomainError,
  Result,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { IssueComment } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListPullRequestCommentsInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly page?: number;
  readonly perPage?: number;
}

export const listPullRequestComments =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListPullRequestCommentsInput,
  ): Promise<Result<readonly IssueComment[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    return ok(
      await github.listPullRequestComments({
        repo: repo.value,
        pullNumber: pullNumber.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
