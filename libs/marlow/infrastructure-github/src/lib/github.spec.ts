import { GitHubPortError } from '@org/marlow-application';
import type {
  IssueNumber,
  PullRequestNumber,
  RepoRef,
} from '@org/marlow-domain';
import type { Octokit } from 'octokit';
import { RequestError } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import { createGitHubRepositoryAdapter } from '../index.js';
import { mapGitHubError } from './github-error-mapper.js';

const repo = { owner: 'nrwl', repo: 'nx' } as RepoRef;

const requestError = (
  status: number,
  headers: Record<string, string> = {},
): RequestError =>
  new RequestError(`status ${status}`, status, {
    request: { method: 'GET', url: 'https://api.github.com/x', headers: {} },
    response: {
      status,
      url: 'https://api.github.com/x',
      headers,
      data: {},
    },
  });

describe('mapGitHubError', () => {
  it('maps HTTP statuses to transport-neutral kinds', () => {
    expect(mapGitHubError(requestError(401)).kind).toBe('unauthorized');
    expect(mapGitHubError(requestError(404)).kind).toBe('not_found');
    expect(mapGitHubError(requestError(422)).kind).toBe('validation_failed');
    expect(mapGitHubError(requestError(503)).kind).toBe('unavailable');
  });

  it('treats a 403 with no remaining rate limit as rate_limited', () => {
    const error = mapGitHubError(
      requestError(403, { 'x-ratelimit-remaining': '0' }),
    );
    expect(error.kind).toBe('rate_limited');
  });

  it('drops the raw upstream message but keeps the safe status code', () => {
    const raw = new RequestError('token ghp_supersecret rejected', 404, {
      request: { method: 'GET', url: 'https://api.github.com/x', headers: {} },
    });
    const mapped = mapGitHubError(raw);
    expect(mapped.message).not.toContain('ghp_supersecret');
    expect(mapped.message).toContain('404');
  });
});

describe('createGitHubRepositoryAdapter', () => {
  it('maps an issue and never exposes the raw payload', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 12,
        title: 'A bug',
        state: 'open',
        body: 'details',
        user: { login: 'octocat' },
        labels: ['bug', { name: 'p1' }],
        assignees: [{ login: 'octocat' }, null],
        milestone: { number: 4, title: 'v2', due_on: '2020-02-01T00:00:00Z' },
        comments: 3,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-02T00:00:00Z',
        secret_internal_field: 'should-not-appear',
      },
    });
    const octokit = { rest: { issues: { get } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const issue = await adapter.getIssue({
      repo,
      issueNumber: 12 as IssueNumber,
    });

    expect(issue).toEqual({
      number: 12,
      title: 'A bug',
      state: 'open',
      body: 'details',
      author: 'octocat',
      labels: ['bug', 'p1'],
      assignees: ['octocat'],
      milestone: { number: 4, title: 'v2' },
      commentCount: 3,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-02T00:00:00Z',
    });
    expect(JSON.stringify(issue)).not.toContain('secret_internal_field');
  });

  it('filters pull requests out of the issue list', async () => {
    const listForRepo = vi.fn().mockResolvedValue({
      data: [
        baseIssue(1),
        { ...baseIssue(2), pull_request: { url: 'x' } },
        baseIssue(3),
      ],
    });
    const octokit = {
      rest: { issues: { listForRepo } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const issues = await adapter.listIssues({ repo, state: 'open' });

    expect(issues.map((issue) => issue.number)).toEqual([1, 3]);
  });

  it('converts provider errors into GitHubPortError', async () => {
    const get = vi.fn().mockRejectedValue(requestError(404));
    const octokit = { rest: { issues: { get } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    await expect(
      adapter.getIssue({ repo, issueNumber: 99 as IssueNumber }),
    ).rejects.toBeInstanceOf(GitHubPortError);
  });

  it('updateIssue sends only the provided edit fields', async () => {
    const update = vi.fn().mockResolvedValue({ data: baseIssue(8) });
    const octokit = { rest: { issues: { update } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const issue = await adapter.updateIssue({
      repo,
      issueNumber: 8 as IssueNumber,
      title: 'Edited',
      state: 'open',
      stateReason: 'reopened',
    });

    expect(issue.number).toBe(8);
    expect(update).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 8,
      title: 'Edited',
      state: 'open',
      state_reason: 'reopened',
    });
  });

  it('addLabels returns the updated label set from a label array', async () => {
    const addLabels = vi
      .fn()
      .mockResolvedValue({ data: [{ name: 'bug' }, { name: 'p1' }] });
    const octokit = { rest: { issues: { addLabels } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const result = await adapter.addLabels({
      repo,
      issueNumber: 3 as IssueNumber,
      labels: ['bug', 'p1'],
    });

    expect(result).toEqual({ labels: ['bug', 'p1'] });
    expect(addLabels).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 3,
      labels: ['bug', 'p1'],
    });
  });

  it('removeLabel returns the remaining labels', async () => {
    const removeLabel = vi.fn().mockResolvedValue({ data: [{ name: 'p1' }] });
    const octokit = { rest: { issues: { removeLabel } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const result = await adapter.removeLabel({
      repo,
      issueNumber: 3 as IssueNumber,
      label: 'bug',
    });

    expect(result).toEqual({ labels: ['p1'] });
    expect(removeLabel).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 3,
      name: 'bug',
    });
  });

  it('addAssignees maps the assignee logins off the issue payload', async () => {
    const addAssignees = vi.fn().mockResolvedValue({
      data: { assignees: [{ login: 'octocat' }, null] },
    });
    const octokit = {
      rest: { issues: { addAssignees } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const result = await adapter.addAssignees({
      repo,
      issueNumber: 7 as IssueNumber,
      assignees: ['octocat'],
    });

    expect(result).toEqual({ assignees: ['octocat'] });
    expect(addAssignees).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 7,
      assignees: ['octocat'],
    });
  });

  it('setMilestone and clearMilestone map the milestone result', async () => {
    const set = vi
      .fn()
      .mockResolvedValue({ data: { milestone: { number: 2, title: 'v1' } } });
    const adapterSet = createGitHubRepositoryAdapter({
      rest: { issues: { update: set } },
    } as unknown as Octokit);
    const setResult = await adapterSet.setMilestone({
      repo,
      issueNumber: 4 as IssueNumber,
      milestone: 2,
    });
    expect(setResult).toEqual({ milestone: { number: 2, title: 'v1' } });
    expect(set).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 4,
      milestone: 2,
    });

    const clear = vi.fn().mockResolvedValue({ data: { milestone: null } });
    const adapterClear = createGitHubRepositoryAdapter({
      rest: { issues: { update: clear } },
    } as unknown as Octokit);
    const clearResult = await adapterClear.clearMilestone({
      repo,
      issueNumber: 4 as IssueNumber,
    });
    expect(clearResult).toEqual({ milestone: null });
    expect(clear).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      issue_number: 4,
      milestone: null,
    });
  });

  it('surfaces labels, assignees, and milestone on a pull request', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 42,
        title: 'A change',
        state: 'open',
        body: null,
        user: { login: 'octocat' },
        head: { ref: 'feature' },
        base: { ref: 'main' },
        draft: false,
        merged_at: null,
        labels: [{ name: 'wip' }],
        assignees: [{ login: 'hubot' }],
        milestone: { number: 1, title: 'v1', state: 'open' },
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-02T00:00:00Z',
      },
    });
    const octokit = { rest: { pulls: { get } } } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const pull = await adapter.getPullRequest({
      repo,
      pullNumber: 42 as PullRequestNumber,
    });

    expect(pull.labels).toEqual(['wip']);
    expect(pull.assignees).toEqual(['hubot']);
    expect(pull.milestone).toEqual({ number: 1, title: 'v1' });
  });
});

function baseIssue(number: number) {
  return {
    number,
    title: `Issue ${number}`,
    state: 'open',
    body: null,
    user: { login: 'octocat' },
    labels: [],
    assignees: [],
    milestone: null,
    comments: 0,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-01T00:00:00Z',
  };
}
