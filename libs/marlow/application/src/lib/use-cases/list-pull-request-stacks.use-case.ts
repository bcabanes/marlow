import {
  DomainError,
  Result,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestStack } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListPullRequestStacksInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber?: number;
  readonly page?: number;
  readonly perPage?: number;
}

export const listPullRequestStacks =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListPullRequestStacksInput,
  ): Promise<Result<readonly PullRequestStack[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber =
      input.pullNumber === undefined
        ? undefined
        : createPullRequestNumber(input.pullNumber);
    if (pullNumber !== undefined && !pullNumber.ok) return pullNumber;
    return ok(
      await github.listPullRequestStacks({
        repo: repo.value,
        pullNumber: pullNumber?.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
