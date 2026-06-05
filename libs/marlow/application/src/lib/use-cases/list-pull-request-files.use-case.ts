import {
  DomainError,
  Result,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestFile } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListPullRequestFilesInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly page?: number;
  readonly perPage?: number;
}

export const listPullRequestFiles =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListPullRequestFilesInput,
  ): Promise<Result<readonly PullRequestFile[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    return ok(
      await github.listPullRequestFiles({
        repo: repo.value,
        pullNumber: pullNumber.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
