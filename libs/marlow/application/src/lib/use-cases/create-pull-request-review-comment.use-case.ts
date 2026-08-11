import {
  DomainError,
  Result,
  createFilePath,
  createGitSha,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { ReviewComment } from '../dtos.js';
import {
  GitHubRepositoryPort,
  PullRequestReviewSide,
} from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

interface CreatePullRequestReviewCommentBaseInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly body: string;
  readonly commitId: string;
  readonly path: string;
}

export type CreatePullRequestReviewCommentInput =
  CreatePullRequestReviewCommentBaseInput &
    (
      | {
          readonly subjectType?: 'line';
          readonly line: number;
          readonly side: PullRequestReviewSide;
          readonly startLine?: number;
          readonly startSide?: PullRequestReviewSide;
        }
      | {
          readonly subjectType: 'file';
        }
    );

export const createPullRequestReviewComment =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreatePullRequestReviewCommentInput,
  ): Promise<Result<ReviewComment, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    const commitId = createGitSha(input.commitId);
    if (!commitId.ok) return commitId;
    const path = createFilePath(input.path);
    if (!path.ok) return path;

    const target =
      input.subjectType === 'file'
        ? ({ subjectType: 'file', path: path.value } as const)
        : ({
            subjectType: 'line',
            path: path.value,
            line: input.line,
            side: input.side,
            startLine: input.startLine,
            startSide: input.startSide,
          } as const);

    return ok(
      await github.createPullRequestReviewComment({
        repo: repo.value,
        pullNumber: pullNumber.value,
        body: input.body,
        commitId: commitId.value,
        target,
      }),
    );
  };
