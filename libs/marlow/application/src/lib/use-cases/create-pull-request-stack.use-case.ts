import { DomainError, Result, ok } from '@org/marlow-domain';
import { PullRequestStack } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';
import { validatePullRequestNumbers } from './pull-request-stack-validation.js';

export interface CreatePullRequestStackInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumbers: readonly number[];
}

export const createPullRequestStack =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreatePullRequestStackInput,
  ): Promise<Result<PullRequestStack, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumbers = validatePullRequestNumbers(input.pullNumbers);
    if (!pullNumbers.ok) return pullNumbers;
    return ok(
      await github.createPullRequestStack({
        repo: repo.value,
        pullNumbers: pullNumbers.value,
      }),
    );
  };
