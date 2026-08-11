import type { GitHubRepositoryPort } from '@org/marlow-application';
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

  it('starts and polls a stacked pull-request merge', async () => {
    const mergeId = '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42';
    const mergePullRequestAsync = vi.fn().mockResolvedValue({
      status: 'pending',
      message: 'Merge request enqueued.',
      id: mergeId,
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

    expect(submitted.statusCode).toBe(200);
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
