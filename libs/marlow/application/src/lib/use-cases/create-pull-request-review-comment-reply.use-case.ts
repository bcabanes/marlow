import {
  DomainError,
  Result,
  createPullRequestNumber,
  createReviewCommentId,
  ok,
} from '@org/marlow-domain';
import { ReviewComment } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CreatePullRequestReviewCommentReplyInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly commentId: number;
  readonly body: string;
}

export const createPullRequestReviewCommentReply =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreatePullRequestReviewCommentReplyInput,
  ): Promise<Result<ReviewComment, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    const commentId = createReviewCommentId(input.commentId);
    if (!commentId.ok) return commentId;

    return ok(
      await github.createPullRequestReviewCommentReply({
        repo: repo.value,
        pullNumber: pullNumber.value,
        commentId: commentId.value,
        body: input.body,
      }),
    );
  };
