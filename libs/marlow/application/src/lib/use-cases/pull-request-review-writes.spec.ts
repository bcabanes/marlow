import { describe, expect, it, vi } from 'vitest';
import {
  GitHubRepositoryPort,
  createPullRequestReview,
  createPullRequestReviewComment,
  createPullRequestReviewCommentReply,
} from '../../index.js';

const fakePort = (
  overrides: Partial<GitHubRepositoryPort> = {},
): GitHubRepositoryPort => overrides as GitHubRepositoryPort;

const reviewComment = {
  id: 555,
  author: 'octocat',
  body: 'Please rename this',
  path: 'src/index.ts',
  line: 12,
  originalLine: 12,
  side: 'RIGHT',
  startLine: null,
  startSide: null,
  diffHunk: '@@ -10,3 +10,3 @@',
  commitId: 'a'.repeat(40),
  originalCommitId: 'a'.repeat(40),
  inReplyToId: null,
  pullRequestReviewId: 901,
  htmlUrl: 'https://github.com/nrwl/nx/pull/42#discussion_r555',
  subjectType: 'line',
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
};

describe('pull-request review write use cases', () => {
  const allowed = { owner: 'nrwl', repo: 'nx', pullNumber: 42 };

  it('validates and forwards an immediate range comment', async () => {
    const create = vi.fn().mockResolvedValue(reviewComment);
    const port = fakePort({ createPullRequestReviewComment: create });

    const result = await createPullRequestReviewComment(port)({
      ...allowed,
      body: 'Please rename this',
      commitId: 'a'.repeat(40),
      path: 'src/index.ts',
      line: 12,
      side: 'RIGHT',
      startLine: 10,
      startSide: 'RIGHT',
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      body: 'Please rename this',
      commitId: 'a'.repeat(40),
      target: {
        subjectType: 'line',
        path: 'src/index.ts',
        line: 12,
        side: 'RIGHT',
        startLine: 10,
        startSide: 'RIGHT',
      },
    });
  });

  it('rejects invalid anchors before calling GitHub', async () => {
    const create = vi.fn();
    const port = fakePort({ createPullRequestReviewComment: create });

    const invalidSha = await createPullRequestReviewComment(port)({
      ...allowed,
      body: 'x',
      commitId: 'not-a-sha',
      path: 'src/index.ts',
      line: 1,
      side: 'RIGHT',
    });
    const invalidPath = await createPullRequestReviewComment(port)({
      ...allowed,
      body: 'x',
      commitId: 'a'.repeat(40),
      path: '../secret',
      line: 1,
      side: 'RIGHT',
    });

    expect(invalidSha.ok).toBe(false);
    expect(invalidPath.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects disallowed repositories before calling GitHub', async () => {
    const create = vi.fn();
    const port = fakePort({ createPullRequestReviewComment: create });
    const result = await createPullRequestReviewComment(port)({
      owner: 'evil',
      repo: 'repo',
      pullNumber: 42,
      body: 'x',
      commitId: 'a'.repeat(40),
      path: 'src/index.ts',
      line: 1,
      side: 'RIGHT',
    });

    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('validates the parent review-comment ID', async () => {
    const reply = vi.fn().mockResolvedValue(reviewComment);
    const port = fakePort({ createPullRequestReviewCommentReply: reply });

    const invalid = await createPullRequestReviewCommentReply(port)({
      ...allowed,
      commentId: 0,
      body: 'Reply',
    });
    const valid = await createPullRequestReviewCommentReply(port)({
      ...allowed,
      commentId: 555,
      body: 'Reply',
    });

    expect(invalid.ok).toBe(false);
    expect(valid.ok).toBe(true);
    expect(reply).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      commentId: 555,
      body: 'Reply',
    });
  });

  it('forwards a pending review with every validated comment path', async () => {
    const review = {
      id: 901,
      author: 'octocat',
      state: 'PENDING',
      body: null,
      submittedAt: null,
      htmlUrl:
        'https://github.com/nrwl/nx/pull/42#pullrequestreview-901',
    };
    const create = vi.fn().mockResolvedValue(review);
    const port = fakePort({ createPullRequestReview: create });

    const result = await createPullRequestReview(port)({
      ...allowed,
      event: 'PENDING',
      comments: [
        {
          body: 'First inline',
          path: 'src/first.ts',
          line: 12,
          side: 'RIGHT',
        },
        {
          body: 'Second inline',
          path: 'src/second.ts',
          line: 8,
          side: 'LEFT',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      event: 'PENDING',
      comments: [
        {
          body: 'First inline',
          path: 'src/first.ts',
          line: 12,
          side: 'RIGHT',
          startLine: undefined,
          startSide: undefined,
        },
        {
          body: 'Second inline',
          path: 'src/second.ts',
          line: 8,
          side: 'LEFT',
          startLine: undefined,
          startSide: undefined,
        },
      ],
    });
  });
});
