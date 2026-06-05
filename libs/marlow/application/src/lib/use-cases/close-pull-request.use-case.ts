import {
  DomainError,
  Result,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequest } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ClosePullRequestInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
}

export const closePullRequest =
  (github: GitHubRepositoryPort) =>
  async (
    input: ClosePullRequestInput,
  ): Promise<Result<PullRequest, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    return ok(
      await github.closePullRequest({
        repo: repo.value,
        pullNumber: pullNumber.value,
      }),
    );
  };
