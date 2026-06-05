import {
  DomainError,
  GitRef,
  Result,
  createGitRef,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequest } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface UpdatePullRequestInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly title?: string;
  readonly body?: string;
  readonly base?: string;
}

export const updatePullRequest =
  (github: GitHubRepositoryPort) =>
  async (
    input: UpdatePullRequestInput,
  ): Promise<Result<PullRequest, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;

    let base: GitRef | undefined;
    if (input.base !== undefined) {
      const parsed = createGitRef(input.base);
      if (!parsed.ok) return parsed;
      base = parsed.value;
    }

    return ok(
      await github.updatePullRequest({
        repo: repo.value,
        pullNumber: pullNumber.value,
        title: input.title,
        body: input.body,
        base,
      }),
    );
  };
