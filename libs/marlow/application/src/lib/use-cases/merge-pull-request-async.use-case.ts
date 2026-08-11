import {
  DomainError,
  Result,
  createGitSha,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import {
  AsyncMergeResult,
  PullRequestMergeAction,
  PullRequestMergeMethod,
} from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface MergePullRequestAsyncInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly mergeMethod?: PullRequestMergeMethod;
  readonly mergeAction?: PullRequestMergeAction;
  readonly commitTitle?: string;
  readonly commitMessage?: string;
  readonly expectedHeadSha?: string;
}

export const mergePullRequestAsync =
  (github: GitHubRepositoryPort) =>
  async (
    input: MergePullRequestAsyncInput,
  ): Promise<Result<AsyncMergeResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    const expectedHeadSha =
      input.expectedHeadSha === undefined
        ? undefined
        : createGitSha(input.expectedHeadSha);
    if (expectedHeadSha !== undefined && !expectedHeadSha.ok) {
      return expectedHeadSha;
    }
    return ok(
      await github.mergePullRequestAsync({
        repo: repo.value,
        pullNumber: pullNumber.value,
        mergeMethod: input.mergeMethod,
        mergeAction: input.mergeAction,
        commitTitle: input.commitTitle,
        commitMessage: input.commitMessage,
        expectedHeadSha: expectedHeadSha?.value,
      }),
    );
  };
