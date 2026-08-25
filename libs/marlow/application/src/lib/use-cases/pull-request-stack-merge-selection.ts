import { PullRequestStackEntry } from '../dtos.js';

export type PullRequestStackMergeSelection =
  | {
      readonly outcome: 'complete';
      readonly skippedMergedPullRequestNumbers: readonly number[];
    }
  | {
      readonly outcome: 'blocked';
      readonly skippedMergedPullRequestNumbers: readonly number[];
      readonly blocker: {
        readonly pullRequestNumber: number;
        readonly reason: 'draft' | 'closed';
      };
    }
  | {
      readonly outcome: 'target';
      readonly targetPullRequestNumber: number;
      readonly skippedMergedPullRequestNumbers: readonly number[];
    };

/** Implements the non-interactive whole-stack target policy from `gh stack merge`. */
export const selectPullRequestStackMergeTarget = (
  pullRequests: readonly PullRequestStackEntry[],
): PullRequestStackMergeSelection => {
  const skippedMergedPullRequestNumbers: number[] = [];
  let targetPullRequestNumber: number | undefined;

  for (const pullRequest of pullRequests) {
    if (pullRequest.mergedAt !== null) {
      skippedMergedPullRequestNumbers.push(pullRequest.number);
      continue;
    }
    if (pullRequest.draft) {
      return {
        outcome: 'blocked',
        skippedMergedPullRequestNumbers,
        blocker: {
          pullRequestNumber: pullRequest.number,
          reason: 'draft',
        },
      };
    }
    if (pullRequest.state === 'closed') {
      return {
        outcome: 'blocked',
        skippedMergedPullRequestNumbers,
        blocker: {
          pullRequestNumber: pullRequest.number,
          reason: 'closed',
        },
      };
    }
    targetPullRequestNumber = pullRequest.number;
  }

  return targetPullRequestNumber === undefined
    ? { outcome: 'complete', skippedMergedPullRequestNumbers }
    : {
        outcome: 'target',
        targetPullRequestNumber,
        skippedMergedPullRequestNumbers,
      };
};
