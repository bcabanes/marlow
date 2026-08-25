import type { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { describe, expect, it, vi } from 'vitest';
import { createPullRequestStack } from './create-pull-request-stack.use-case.js';
import { mergePullRequestStack } from './merge-pull-request-stack.use-case.js';

const stack = {
  id: 1,
  number: 42,
  nodeId: 'stack-node',
  url: 'https://api.github.com/repos/nrwl/nx/stacks/42',
  baseRef: 'main',
  open: true,
  createdAt: '2026-04-15T10:00:00Z',
  pullRequests: [
    {
      id: 101,
      nodeId: 'pr-101',
      title: 'Model',
      htmlUrl: 'https://github.com/nrwl/nx/pull/101',
      author: 'octocat',
      number: 101,
      url: 'https://api.github.com/repos/nrwl/nx/pulls/101',
      state: 'closed' as const,
      draft: false,
      mergedAt: '2026-04-15T11:00:00Z',
      headRef: 'model',
      headSha: 'a'.repeat(40),
      baseRef: 'main',
      baseSha: '0'.repeat(40),
    },
    {
      id: 102,
      nodeId: 'pr-102',
      title: 'API',
      htmlUrl: 'https://github.com/nrwl/nx/pull/102',
      author: 'octocat',
      number: 102,
      url: 'https://api.github.com/repos/nrwl/nx/pulls/102',
      state: 'open' as const,
      draft: false,
      mergedAt: null,
      headRef: 'api',
      headSha: 'b'.repeat(40),
      baseRef: 'model',
      baseSha: 'a'.repeat(40),
    },
  ],
};

const portWith = (
  overrides: Partial<GitHubRepositoryPort>,
): GitHubRepositoryPort => overrides as GitHubRepositoryPort;

describe('mergePullRequestStack', () => {
  it('skips merged entries and submits the highest eligible pull request', async () => {
    const getPullRequestStack = vi.fn().mockResolvedValue(stack);
    const mergePullRequestAsync = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      merge: {
        status: 'pending',
        message: 'accepted',
        id: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
        mergeMethod: 'squash',
        mergeAction: 'default',
        expectedHeadSha: 'b'.repeat(40),
      },
    });

    const result = await mergePullRequestStack(
      portWith({ getPullRequestStack, mergePullRequestAsync }),
    )({ owner: 'nrwl', repo: 'nx', stackNumber: 42, mergeMethod: 'squash' });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        outcome: 'submitted',
        targetPullRequestNumber: 102,
        skippedMergedPullRequestNumbers: [101],
      }),
    });
    expect(mergePullRequestAsync).toHaveBeenCalledWith(
      expect.objectContaining({ pullNumber: 102, mergeAction: 'default' }),
    );
  });

  it.each([
    ['draft', { draft: true, state: 'open' as const }],
    ['closed', { draft: false, state: 'closed' as const }],
  ] as const)(
    'blocks the whole stack at a %s pull request',
    async (reason, state) => {
      const getPullRequestStack = vi.fn().mockResolvedValue({
        ...stack,
        pullRequests: [
          stack.pullRequests[0],
          { ...stack.pullRequests[1], ...state },
        ],
      });
      const mergePullRequestAsync = vi.fn();

      const result = await mergePullRequestStack(
        portWith({ getPullRequestStack, mergePullRequestAsync }),
      )({ owner: 'nrwl', repo: 'nx', stackNumber: 42 });

      expect(result).toEqual({
        ok: true,
        value: {
          outcome: 'blocked',
          stackNumber: 42,
          skippedMergedPullRequestNumbers: [101],
          blocker: { pullRequestNumber: 102, reason },
        },
      });
      expect(mergePullRequestAsync).not.toHaveBeenCalled();
    },
  );

  it('reports an already-merged stack without submitting', async () => {
    const getPullRequestStack = vi.fn().mockResolvedValue({
      ...stack,
      pullRequests: stack.pullRequests.map((pullRequest) => ({
        ...pullRequest,
        state: 'closed' as const,
        mergedAt: '2026-04-15T11:00:00Z',
      })),
    });
    const mergePullRequestAsync = vi.fn();

    const result = await mergePullRequestStack(
      portWith({ getPullRequestStack, mergePullRequestAsync }),
    )({ owner: 'nrwl', repo: 'nx', stackNumber: 42 });

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: 'complete',
        stackNumber: 42,
        skippedMergedPullRequestNumbers: [101, 102],
      },
    });
    expect(mergePullRequestAsync).not.toHaveBeenCalled();
  });
});

describe('stack member invariants', () => {
  it('rejects duplicate members for direct application callers', async () => {
    const createStack = vi.fn();

    const result = await createPullRequestStack(
      portWith({ createPullRequestStack: createStack }),
    )({ owner: 'nrwl', repo: 'nx', pullNumbers: [101, 101] });

    expect(result.ok).toBe(false);
    expect(createStack).not.toHaveBeenCalled();
  });
});
