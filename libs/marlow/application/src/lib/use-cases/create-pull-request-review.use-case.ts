import {
  DomainError,
  Result,
  createFilePath,
  createGitSha,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { PullRequestReview } from '../dtos.js';
import {
  GitHubRepositoryPort,
  PullRequestReviewDraftComment,
  PullRequestReviewEvent,
  PullRequestReviewSide,
} from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CreatePullRequestReviewInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly event: PullRequestReviewEvent;
  readonly commitId?: string;
  readonly body?: string;
  readonly comments?: readonly {
    readonly body: string;
    readonly path: string;
    readonly line: number;
    readonly side: PullRequestReviewSide;
    readonly startLine?: number;
    readonly startSide?: PullRequestReviewSide;
  }[];
}

export const createPullRequestReview =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreatePullRequestReviewInput,
  ): Promise<Result<PullRequestReview, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;

    const commitId =
      input.commitId === undefined ? undefined : createGitSha(input.commitId);
    if (commitId !== undefined && !commitId.ok) return commitId;

    let comments: PullRequestReviewDraftComment[] | undefined;
    if (input.comments !== undefined) {
      comments = [];
      for (const comment of input.comments) {
        const path = createFilePath(comment.path);
        if (!path.ok) return path;
        comments.push({
          body: comment.body,
          path: path.value,
          line: comment.line,
          side: comment.side,
          startLine: comment.startLine,
          startSide: comment.startSide,
        });
      }
    }

    return ok(
      await github.createPullRequestReview({
        repo: repo.value,
        pullNumber: pullNumber.value,
        event: input.event,
        ...(commitId === undefined ? {} : { commitId: commitId.value }),
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(comments === undefined ? {} : { comments }),
      }),
    );
  };
