import {
  DomainError,
  Result,
  createPullRequestStackAdditions,
  createPullRequestStackNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestStack } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface AddPullRequestsToStackInput {
  readonly owner: string;
  readonly repo: string;
  readonly stackNumber: number;
  readonly pullNumbers: readonly number[];
}

export const addPullRequestsToStack =
  (github: GitHubRepositoryPort) =>
  async (
    input: AddPullRequestsToStackInput,
  ): Promise<Result<PullRequestStack, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const stackNumber = createPullRequestStackNumber(input.stackNumber);
    if (!stackNumber.ok) return stackNumber;
    const pullNumbers = createPullRequestStackAdditions(input.pullNumbers);
    if (!pullNumbers.ok) return pullNumbers;
    return ok(
      await github.addPullRequestsToStack({
        repo: repo.value,
        stackNumber: stackNumber.value,
        pullNumbers: pullNumbers.value,
      }),
    );
  };
