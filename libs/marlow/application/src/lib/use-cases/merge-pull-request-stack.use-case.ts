import {
  DomainError,
  Result,
  createGitSha,
  createPullRequestNumber,
  createPullRequestStackNumber,
  ok,
} from '@org/marlow-domain';
import {
  PullRequestMergeAction,
  PullRequestMergeMethod,
  PullRequestStackMergeResult,
} from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';
import { selectPullRequestStackMergeTarget } from './pull-request-stack-merge-selection.js';

export interface MergePullRequestStackInput {
  readonly owner: string;
  readonly repo: string;
  readonly stackNumber: number;
  readonly mergeMethod?: PullRequestMergeMethod;
  readonly mergeAction?: PullRequestMergeAction;
  readonly commitTitle?: string;
  readonly commitMessage?: string;
  readonly expectedHeadSha?: string;
}

/** Starts one whole-stack merge and leaves long-running polling to the caller. */
export const mergePullRequestStack =
  (github: GitHubRepositoryPort) =>
  async (
    input: MergePullRequestStackInput,
  ): Promise<Result<PullRequestStackMergeResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const stackNumber = createPullRequestStackNumber(input.stackNumber);
    if (!stackNumber.ok) return stackNumber;
    const expectedHeadSha =
      input.expectedHeadSha === undefined
        ? undefined
        : createGitSha(input.expectedHeadSha);
    if (expectedHeadSha !== undefined && !expectedHeadSha.ok) {
      return expectedHeadSha;
    }

    const stack = await github.getPullRequestStack({
      repo: repo.value,
      stackNumber: stackNumber.value,
    });
    const selection = selectPullRequestStackMergeTarget(stack.pullRequests);
    if (selection.outcome !== 'target') {
      return ok({
        ...selection,
        stackNumber: stack.number,
      });
    }

    const pullNumber = createPullRequestNumber(
      selection.targetPullRequestNumber,
    );
    if (!pullNumber.ok) return pullNumber;
    const submission = await github.mergePullRequestAsync({
      repo: repo.value,
      pullNumber: pullNumber.value,
      mergeMethod: input.mergeMethod,
      mergeAction: input.mergeAction ?? 'default',
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
      expectedHeadSha: expectedHeadSha?.value,
    });

    return ok({
      outcome: 'submitted',
      stackNumber: stack.number,
      targetPullRequestNumber: selection.targetPullRequestNumber,
      skippedMergedPullRequestNumbers:
        selection.skippedMergedPullRequestNumbers,
      submission,
    });
  };
