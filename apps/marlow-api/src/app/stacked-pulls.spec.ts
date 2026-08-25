import {
  GitHubPortError,
  type GitHubRepositoryPort,
} from '@org/marlow-application';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './app';
import type { AppConfig } from './config';
import type { AppDependencies } from './dependencies';

const config: AppConfig = {
  host: '127.0.0.1',
  port: 0,
  exposeInternalErrors: true,
  githubToken: 'ghp_test',
  github: {},
};

const stack = {
  id: 9876543,
  number: 42,
  nodeId: 'S_kwDOABCDEF4AAAAA',
  url: 'https://api.github.com/repos/nrwl/nx/stacks/42',
  baseRef: 'main',
  open: true,
  createdAt: '2026-04-15T10:00:00Z',
  pullRequests: [],
};

const stackWithPullRequests = {
  ...stack,
  pullRequests: [
    {
      id: 100001,
      nodeId: 'PR_first',
      title: 'Model',
      htmlUrl: 'https://github.com/nrwl/nx/pull/101',
      author: 'octocat',
      number: 101,
      url: 'https://api.github.com/repos/nrwl/nx/pulls/101',
      state: 'closed' as const,
      draft: false,
      mergedAt: '2026-04-15T11:00:00Z',
      headRef: 'user-model',
      headSha: 'a'.repeat(40),
      baseRef: 'main',
      baseSha: 'c'.repeat(40),
    },
    {
      id: 100002,
      nodeId: 'PR_second',
      title: 'API',
      htmlUrl: 'https://github.com/nrwl/nx/pull/102',
      author: 'octocat',
      number: 102,
      url: 'https://api.github.com/repos/nrwl/nx/pulls/102',
      state: 'open' as const,
      draft: false,
      mergedAt: null,
      headRef: 'user-api',
      headSha: 'b'.repeat(40),
      baseRef: 'user-model',
      baseSha: 'a'.repeat(40),
    },
  ],
};

describe('stacked pull-request routes', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    await server.close();
  });

  const start = async (port: Partial<GitHubRepositoryPort>) => {
    const deps: AppDependencies = {
      config,
      getGitHubPort: async () => port as GitHubRepositoryPort,
    };
    server = Fastify();
    await server.register(app, { deps });
    await server.ready();
  };

  it('lists stacks and supports filtering by pull request', async () => {
    const listPullRequestStacks = vi.fn().mockResolvedValue([stack]);
    await start({ listPullRequestStacks });

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/stacks?pullNumber=102&page=2&perPage=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([stack]);
    expect(listPullRequestStacks).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 102,
      page: 2,
      perPage: 10,
    });
  });

  it('creates a stack from bottom-to-top pull request numbers', async () => {
    const createPullRequestStack = vi.fn().mockResolvedValue(stack);
    await start({ createPullRequestStack });

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks',
      payload: { confirm: true, pullNumbers: [101, 102] },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(stack);
    expect(createPullRequestStack).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumbers: [101, 102],
    });
  });

  it('gets a full stack and appends members', async () => {
    const getPullRequestStack = vi
      .fn()
      .mockResolvedValue(stackWithPullRequests);
    const addPullRequestsToStack = vi
      .fn()
      .mockResolvedValue(stackWithPullRequests);
    await start({ getPullRequestStack, addPullRequestsToStack });

    const shown = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/stacks/42',
    });
    const added = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks/42/add',
      payload: { confirm: true, pullNumbers: [103] },
    });

    expect(shown.json()).toEqual(stackWithPullRequests);
    expect(added.statusCode).toBe(200);
    expect(addPullRequestsToStack).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      stackNumber: 42,
      pullNumbers: [103],
    });
  });

  it('preserves updated and dissolved unstack responses', async () => {
    const unstackPullRequests = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: 'updated',
        stack: stackWithPullRequests,
      })
      .mockResolvedValueOnce({ outcome: 'dissolved' });
    await start({ unstackPullRequests });

    const updated = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks/42/unstack',
      payload: { confirm: true },
    });
    const dissolved = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks/42/unstack',
      payload: { confirm: true },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual(stackWithPullRequests);
    expect(dissolved.statusCode).toBe(204);
    expect(dissolved.body).toBe('');
  });

  it('maps concurrent stack mutation to conflict', async () => {
    const addPullRequestsToStack = vi
      .fn()
      .mockRejectedValue(new GitHubPortError('conflict', 'concurrent update'));
    await start({ addPullRequestsToStack });

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks/42/add',
      payload: { confirm: true, pullNumbers: [103] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('conflict');
  });

  it('starts and polls a stacked pull-request merge', async () => {
    const mergeId = '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42';
    const mergePullRequestAsync = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      merge: {
        status: 'pending',
        message: 'Merge request enqueued.',
        id: mergeId,
        mergeMethod: 'squash',
        mergeAction: 'default',
        expectedHeadSha: 'b'.repeat(40),
      },
    });
    const getPullRequestMergeResult = vi.fn().mockResolvedValue({
      status: 'merged',
      message: 'Pull request was merged.',
      mergeCommitSha: 'c'.repeat(40),
    });
    await start({ mergePullRequestAsync, getPullRequestMergeResult });

    const submitted = await server.inject({
      method: 'PUT',
      url: '/repos/nrwl/nx/pulls/102/merge-async',
      payload: {
        confirm: true,
        mergeMethod: 'squash',
        mergeAction: 'default',
        expectedHeadSha: 'b'.repeat(40),
      },
    });
    const result = await server.inject({
      method: 'GET',
      url: `/repos/nrwl/nx/pulls/102/merge-async/${mergeId}`,
    });

    expect(submitted.statusCode).toBe(202);
    expect(submitted.json()).toEqual(
      expect.objectContaining({
        outcome: 'accepted',
        next: {
          method: 'GET',
          url: `/repos/nrwl/nx/pulls/102/merge-async/${mergeId}`,
        },
      }),
    );
    expect(result.json().status).toBe('merged');
    expect(mergePullRequestAsync).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 102,
      mergeMethod: 'squash',
      mergeAction: 'default',
      commitTitle: undefined,
      commitMessage: undefined,
      expectedHeadSha: 'b'.repeat(40),
    });
    expect(getPullRequestMergeResult).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 102,
      mergeId,
    });
  });

  it.each([
    [
      200,
      {
        outcome: 'completed',
        merge: {
          status: 'merged',
          message: 'Already merged.',
          mergeCommitSha: 'c'.repeat(40),
        },
      },
    ],
    [
      400,
      {
        outcome: 'rejected',
        merge: { status: 'failed', message: 'Pull request is a draft.' },
      },
    ],
    [
      409,
      {
        outcome: 'alreadyPending',
        merge: {
          status: 'pending',
          message: 'Merge already pending.',
          id: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
          mergeMethod: 'squash',
          mergeAction: 'default',
          expectedHeadSha: 'b'.repeat(40),
        },
      },
    ],
  ] as const)(
    'maps async merge submission outcome to HTTP %i',
    async (statusCode, submission) => {
      await start({
        mergePullRequestAsync: vi.fn().mockResolvedValue(submission),
      });

      const response = await server.inject({
        method: 'PUT',
        url: '/repos/nrwl/nx/pulls/102/merge-async',
        payload: { confirm: true },
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json().outcome).toBe(submission.outcome);
    },
  );

  it('starts a whole-stack merge at the top eligible pull request', async () => {
    const mergeId = '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42';
    const getPullRequestStack = vi
      .fn()
      .mockResolvedValue(stackWithPullRequests);
    const mergePullRequestAsync = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      merge: {
        status: 'pending',
        message: 'Merge request enqueued.',
        id: mergeId,
        mergeMethod: 'squash',
        mergeAction: 'default',
        expectedHeadSha: 'b'.repeat(40),
      },
    });
    await start({ getPullRequestStack, mergePullRequestAsync });

    const response = await server.inject({
      method: 'PUT',
      url: '/repos/nrwl/nx/stacks/42/merge-async',
      payload: { confirm: true, mergeMethod: 'squash' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual(
      expect.objectContaining({
        outcome: 'submitted',
        targetPullRequestNumber: 102,
        skippedMergedPullRequestNumbers: [101],
        next: {
          method: 'GET',
          url: `/repos/nrwl/nx/pulls/102/merge-async/${mergeId}`,
        },
      }),
    );
    expect(mergePullRequestAsync).toHaveBeenCalledWith(
      expect.objectContaining({ pullNumber: 102, mergeAction: 'default' }),
    );
  });

  it('returns a conflict without submitting when the whole stack is blocked', async () => {
    const getPullRequestStack = vi.fn().mockResolvedValue({
      ...stackWithPullRequests,
      pullRequests: [
        stackWithPullRequests.pullRequests[0],
        { ...stackWithPullRequests.pullRequests[1], draft: true },
      ],
    });
    const mergePullRequestAsync = vi.fn();
    await start({ getPullRequestStack, mergePullRequestAsync });

    const response = await server.inject({
      method: 'PUT',
      url: '/repos/nrwl/nx/stacks/42/merge-async',
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      outcome: 'blocked',
      stackNumber: 42,
      skippedMergedPullRequestNumbers: [101],
      blocker: { pullRequestNumber: 102, reason: 'draft' },
    });
    expect(mergePullRequestAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid stack bodies before reaching GitHub', async () => {
    const createPullRequestStack = vi.fn();
    await start({ createPullRequestStack });

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/stacks',
      payload: { confirm: true, pullNumbers: [101, 101] },
    });

    expect(response.statusCode).toBe(400);
    expect(createPullRequestStack).not.toHaveBeenCalled();
  });
});
