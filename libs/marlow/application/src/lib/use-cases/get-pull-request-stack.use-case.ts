import {
  DomainError,
  Result,
  createPullRequestStackNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestStack } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetPullRequestStackInput {
  readonly owner: string;
  readonly repo: string;
  readonly stackNumber: number;
}

export const getPullRequestStack =
  (github: GitHubRepositoryPort) =>
  async (
    input: GetPullRequestStackInput,
  ): Promise<Result<PullRequestStack, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const stackNumber = createPullRequestStackNumber(input.stackNumber);
    if (!stackNumber.ok) return stackNumber;
    return ok(
      await github.getPullRequestStack({
        repo: repo.value,
        stackNumber: stackNumber.value,
      }),
    );
  };
