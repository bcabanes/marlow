import type {
  AsyncMergeId,
  GitSha,
  PullRequestNumber,
  PullRequestStackNumber,
} from '@org/marlow-domain';
import { GitHubPortError } from '@org/marlow-application';
import {
  createNewPullRequestStackMembers,
  createPullRequestStackAdditions,
} from '@org/marlow-domain';
import type { Octokit } from 'octokit';
import { RequestError } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import { createGitHubRepositoryAdapter } from './github-repository.adapter.js';

const repo = { owner: 'nrwl', repo: 'nx' } as const;
const apiHeaders = { 'X-GitHub-Api-Version': '2026-03-10' };

const stackPayload = {
  id: 9876543,
  number: 42,
  node_id: 'S_kwDOABCDEF4AAAAA',
  url: 'https://api.github.com/repos/nrwl/nx/stacks/42',
  base: { ref: 'main' },
  open: true,
  created_at: '2026-04-15T10:00:00Z',
  pull_requests: [
    {
      number: 101,
      state: 'open',
      draft: false,
      merged_at: null,
      head: { ref: 'user-model', sha: 'a'.repeat(40) },
    },
    {
      number: 102,
      state: 'open',
      draft: true,
      merged_at: null,
      head: { ref: 'user-api', sha: 'b'.repeat(40) },
    },
  ],
};

const stackDetailPayload = {
  ...stackPayload,
  pull_requests: stackPayload.pull_requests.map((pull, index) => ({
    ...pull,
    id: 100001 + index,
    node_id: `PR_node_${index}`,
    title: index === 0 ? 'Add user model' : 'Add user API',
    html_url: `https://github.com/nrwl/nx/pull/${pull.number}`,
    user: { login: 'octocat' },
    url: `https://api.github.com/repos/nrwl/nx/pulls/${pull.number}`,
    base: {
      ref: index === 0 ? 'main' : 'user-model',
      sha: index === 0 ? 'c'.repeat(40) : 'a'.repeat(40),
    },
  })),
};

const unwrap = <T>(result: { readonly ok: boolean; readonly value?: T }): T => {
  if (!result.ok) throw new Error('expected valid fixture');
  return result.value as T;
};

const requestError = (status: number, data: unknown): RequestError =>
  new RequestError(`status ${status}`, status, {
    request: { method: 'PUT', url: 'https://api.github.com/x', headers: {} },
    response: {
      status,
      url: 'https://api.github.com/x',
      headers: {},
      data,
    },
  });

describe('stacked pull requests', () => {
  it('maps stack membership on ordinary pull-request responses', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 102,
        title: 'API',
        state: 'open',
        body: null,
        user: { login: 'octocat' },
        head: { ref: 'user-api', sha: 'b'.repeat(40) },
        base: { ref: 'user-model' },
        draft: false,
        merged_at: null,
        labels: [],
        created_at: '2026-04-15T10:00:00Z',
        updated_at: '2026-04-15T10:00:00Z',
        stack: {
          id: 9876543,
          number: 42,
          size: 2,
          position: 2,
          base: { ref: 'main', sha: 'c'.repeat(40) },
        },
      },
    });
    const adapter = createGitHubRepositoryAdapter({
      rest: { pulls: { get } },
    } as unknown as Octokit);

    const pull = await adapter.getPullRequest({
      repo,
      pullNumber: 102 as PullRequestNumber,
    });

    expect(pull.stack).toEqual({
      id: 9876543,
      number: 42,
      size: 2,
      position: 2,
      baseRef: 'main',
      baseSha: 'c'.repeat(40),
    });
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ headers: apiHeaders }),
    );
  });

  it('lists and maps stacks through the preview REST API', async () => {
    const request = vi.fn().mockResolvedValue({ data: [stackPayload] });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    const stacks = await adapter.listPullRequestStacks({
      repo,
      pullNumber: 102 as PullRequestNumber,
      page: 2,
      perPage: 10,
    });

    expect(stacks).toEqual([
      {
        id: 9876543,
        number: 42,
        nodeId: 'S_kwDOABCDEF4AAAAA',
        url: 'https://api.github.com/repos/nrwl/nx/stacks/42',
        baseRef: 'main',
        open: true,
        createdAt: '2026-04-15T10:00:00Z',
        pullRequests: [
          {
            number: 101,
            state: 'open',
            draft: false,
            mergedAt: null,
            headRef: 'user-model',
            headSha: 'a'.repeat(40),
          },
          {
            number: 102,
            state: 'open',
            draft: true,
            mergedAt: null,
            headRef: 'user-api',
            headSha: 'b'.repeat(40),
          },
        ],
      },
    ]);
    expect(request).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/stacks', {
      owner: 'nrwl',
      repo: 'nx',
      pull_request: 102,
      page: 2,
      per_page: 10,
      headers: apiHeaders,
    });
  });

  it('preserves the richer stack detail shape', async () => {
    const request = vi.fn().mockResolvedValue({ data: stackDetailPayload });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    const detail = await adapter.getPullRequestStack({
      repo,
      stackNumber: 42 as PullRequestStackNumber,
    });

    expect(detail.pullRequests[1]).toEqual(
      expect.objectContaining({
        id: 100002,
        title: 'Add user API',
        htmlUrl: 'https://github.com/nrwl/nx/pull/102',
        author: 'octocat',
        baseRef: 'user-model',
        baseSha: 'a'.repeat(40),
      }),
    );
  });

  it('rejects malformed preview payloads at the adapter boundary', async () => {
    const request = vi.fn().mockResolvedValue({
      data: [{ ...stackPayload, pull_requests: [{ number: 101 }] }],
    });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    await expect(adapter.listPullRequestStacks({ repo })).rejects.toMatchObject(
      {
        kind: 'unavailable',
      } satisfies Partial<GitHubPortError>,
    );
  });

  it('creates, extends, and dissolves stacks with ordered PR numbers', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: stackDetailPayload })
      .mockResolvedValueOnce({ data: stackDetailPayload })
      .mockResolvedValueOnce({ data: undefined });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    await adapter.createPullRequestStack({
      repo,
      pullNumbers: unwrap(createNewPullRequestStackMembers([101, 102])),
    });
    await adapter.addPullRequestsToStack({
      repo,
      stackNumber: 42 as PullRequestStackNumber,
      pullNumbers: unwrap(createPullRequestStackAdditions([103])),
    });
    const dissolved = await adapter.unstackPullRequests({
      repo,
      stackNumber: 42 as PullRequestStackNumber,
    });

    expect(request.mock.calls).toEqual([
      [
        'POST /repos/{owner}/{repo}/stacks',
        {
          owner: 'nrwl',
          repo: 'nx',
          pull_requests: [101, 102],
          headers: apiHeaders,
        },
      ],
      [
        'POST /repos/{owner}/{repo}/stacks/{stack_number}/add',
        {
          owner: 'nrwl',
          repo: 'nx',
          stack_number: 42,
          pull_requests: [103],
          headers: apiHeaders,
        },
      ],
      [
        'POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack',
        {
          owner: 'nrwl',
          repo: 'nx',
          stack_number: 42,
          headers: apiHeaders,
        },
      ],
    ]);
    expect(dissolved).toEqual({ outcome: 'dissolved' });
  });

  it('returns the remaining detail when GitHub only partially unstacks', async () => {
    const request = vi.fn().mockResolvedValue({ data: stackDetailPayload });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    const result = await adapter.unstackPullRequests({
      repo,
      stackNumber: 42 as PullRequestStackNumber,
    });

    expect(result).toEqual({
      outcome: 'updated',
      stack: expect.objectContaining({
        number: 42,
        pullRequests: expect.arrayContaining([
          expect.objectContaining({ title: 'Add user model' }),
        ]),
      }),
    });
  });

  it('submits and polls the asynchronous merge required for stacked PRs', async () => {
    const pending = {
      status: 'pending',
      details: {
        message: 'Merge request enqueued.',
        uuid: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
        merge_method: 'squash',
        merge_action: 'default',
        expected_head_sha: 'b'.repeat(40),
      },
    };
    const merged = {
      status: 'merged',
      details: {
        message: 'Pull request was merged.',
        sha: 'c'.repeat(40),
      },
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: pending, status: 202 })
      .mockResolvedValueOnce({ data: merged });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    const submitted = await adapter.mergePullRequestAsync({
      repo,
      pullNumber: 102 as PullRequestNumber,
      mergeMethod: 'squash',
      mergeAction: 'default',
      expectedHeadSha: 'b'.repeat(40) as GitSha,
    });
    const result = await adapter.getPullRequestMergeResult({
      repo,
      pullNumber: 102 as PullRequestNumber,
      mergeId: pending.details.uuid as AsyncMergeId,
    });

    expect(submitted).toEqual({
      outcome: 'accepted',
      merge: {
        status: 'pending',
        message: 'Merge request enqueued.',
        id: pending.details.uuid,
        mergeMethod: 'squash',
        mergeAction: 'default',
        expectedHeadSha: 'b'.repeat(40),
      },
    });
    expect(result).toEqual({
      status: 'merged',
      message: 'Pull request was merged.',
      mergeCommitSha: 'c'.repeat(40),
    });
    expect(request.mock.calls[0]).toEqual([
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async',
      {
        owner: 'nrwl',
        repo: 'nx',
        pull_number: 102,
        headers: apiHeaders,
        merge_method: 'squash',
        merge_action: 'default',
        sha: 'b'.repeat(40),
      },
    ]);
  });

  it.each([
    [
      200,
      {
        status: 'enqueued',
        details: { message: 'Added to merge queue.' },
      },
      'completed',
    ],
    [
      400,
      {
        status: 'failed',
        details: { message: 'Pull request is a draft.' },
      },
      'rejected',
    ],
    [
      409,
      {
        status: 'pending',
        details: {
          message: 'Merge already pending.',
          uuid: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
          merge_method: 'squash',
          merge_action: 'default',
          expected_head_sha: 'b'.repeat(40),
        },
      },
      'alreadyPending',
    ],
  ] as const)(
    'maps GitHub async merge HTTP %i to %s',
    async (status, data, outcome) => {
      const request = vi.fn();
      if (status === 200) {
        request.mockResolvedValue({ status, data });
      } else {
        request.mockRejectedValue(requestError(status, data));
      }
      const adapter = createGitHubRepositoryAdapter({
        request,
      } as unknown as Octokit);

      const result = await adapter.mergePullRequestAsync({
        repo,
        pullNumber: 102 as PullRequestNumber,
      });

      expect(result.outcome).toBe(outcome);
    },
  );

  it('rejects pending merge payloads without poll state', async () => {
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: { status: 'pending', details: { message: 'Pending.' } },
    });
    const adapter = createGitHubRepositoryAdapter({
      request,
    } as unknown as Octokit);

    await expect(
      adapter.mergePullRequestAsync({
        repo,
        pullNumber: 102 as PullRequestNumber,
      }),
    ).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
