import {
  DomainError,
  Result,
  createPullRequestStackNumber,
  ok,
} from '@org/marlow-domain';
import { UnstackPullRequestsResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface UnstackPullRequestsInput {
  readonly owner: string;
  readonly repo: string;
  readonly stackNumber: number;
}

export const unstackPullRequests =
  (github: GitHubRepositoryPort) =>
  async (
    input: UnstackPullRequestsInput,
  ): Promise<Result<UnstackPullRequestsResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const stackNumber = createPullRequestStackNumber(input.stackNumber);
    if (!stackNumber.ok) return stackNumber;
    return ok(
      await github.unstackPullRequests({
        repo: repo.value,
        stackNumber: stackNumber.value,
      }),
    );
  };
