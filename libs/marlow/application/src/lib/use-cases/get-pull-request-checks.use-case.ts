import {
  DomainError,
  Result,
  createGitRef,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestChecks } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetPullRequestChecksInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
}

/**
 * Reads CI for a pull request's current head: resolves the head SHA, then
 * fetches its check runs and combined commit status together.
 */
export const getPullRequestChecks =
  (github: GitHubRepositoryPort) =>
  async (
    input: GetPullRequestChecksInput,
  ): Promise<Result<PullRequestChecks, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;

    const pull = await github.getPullRequest({
      repo: repo.value,
      pullNumber: pullNumber.value,
    });
    const headRef = createGitRef(pull.headSha);
    if (!headRef.ok) return headRef;

    const [checkRuns, combinedStatus] = await Promise.all([
      github.listCheckRuns({ repo: repo.value, ref: headRef.value }),
      github.getCombinedStatus({ repo: repo.value, ref: headRef.value }),
    ]);
    return ok({ headSha: pull.headSha, checkRuns, combinedStatus });
  };
