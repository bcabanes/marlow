import { describe, expect, it, vi } from 'vitest';
import {
  GitHubRepositoryPort,
  addAssignees,
  addLabels,
  clearMilestone,
  createIssue,
  getIssue,
  listRepos,
  listTree,
  removeLabel,
  setMilestone,
  updateIssue,
} from '../../index.js';

const fakePort = (
  overrides: Partial<GitHubRepositoryPort> = {},
): GitHubRepositoryPort =>
  ({
    listTree: vi.fn(),
    createIssue: vi.fn(),
    getIssue: vi.fn(),
    ...overrides,
  }) as unknown as GitHubRepositoryPort;

describe('listRepos', () => {
  it('returns exactly the allow-listed repositories', () => {
    expect(listRepos().map((r) => r.fullName)).toEqual([
      'nrwl/ocean',
      'nrwl/nx',
    ]);
  });
});

describe('allow-list enforcement (security boundary)', () => {
  it('rejects a disallowed repository before GitHub is contacted', async () => {
    const port = fakePort();
    const result = await listTree(port)({
      owner: 'evil',
      repo: 'repo',
      ref: 'main',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('repo_not_allowed');
    expect(port.listTree).not.toHaveBeenCalled();
  });

  it('rejects an invalid ref before GitHub is contacted', async () => {
    const port = fakePort();
    const result = await listTree(port)({
      owner: 'nrwl',
      repo: 'nx',
      ref: 'bad ref',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_git_ref');
    expect(port.listTree).not.toHaveBeenCalled();
  });

  it('calls GitHub for an allowed repository with valid input', async () => {
    const tree = { sha: 'abc', truncated: false, entries: [] };
    const port = fakePort({ listTree: vi.fn().mockResolvedValue(tree) });
    const result = await listTree(port)({
      owner: 'nrwl',
      repo: 'nx',
      ref: 'main',
      recursive: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(tree);
    expect(port.listTree).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      ref: 'main',
      recursive: true,
    });
  });

  it('blocks writes to disallowed repositories', async () => {
    const port = fakePort();
    const result = await createIssue(port)({
      owner: 'nrwl',
      repo: 'not-on-the-list',
      title: 'hello',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('repo_not_allowed');
    expect(port.createIssue).not.toHaveBeenCalled();
  });

  it('validates issue numbers before GitHub is contacted', async () => {
    const port = fakePort();
    const result = await getIssue(port)({
      owner: 'nrwl',
      repo: 'nx',
      issueNumber: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_issue_number');
    expect(port.getIssue).not.toHaveBeenCalled();
  });
});

describe('issue & pull-request metadata use cases', () => {
  const allowed = { owner: 'nrwl', repo: 'nx' };

  it('updateIssue forwards the edit fields for an allowed repo', async () => {
    const issue = { number: 5 };
    const updateIssueFn = vi.fn().mockResolvedValue(issue);
    const port = fakePort({ updateIssue: updateIssueFn });
    const result = await updateIssue(port)({
      ...allowed,
      issueNumber: 5,
      title: 'New title',
      state: 'open',
      stateReason: 'reopened',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(issue);
    expect(updateIssueFn).toHaveBeenCalledWith({
      repo: allowed,
      issueNumber: 5,
      title: 'New title',
      body: undefined,
      state: 'open',
      stateReason: 'reopened',
    });
  });

  it('updateIssue rejects an invalid issue number before GitHub', async () => {
    const updateIssueFn = vi.fn();
    const port = fakePort({ updateIssue: updateIssueFn });
    const result = await updateIssue(port)({
      ...allowed,
      issueNumber: 0,
      title: 'x',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_issue_number');
    expect(updateIssueFn).not.toHaveBeenCalled();
  });

  it('addLabels forwards the labels to the port', async () => {
    const set = { labels: ['bug'] };
    const addLabelsFn = vi.fn().mockResolvedValue(set);
    const port = fakePort({ addLabels: addLabelsFn });
    const result = await addLabels(port)({
      ...allowed,
      issueNumber: 3,
      labels: ['bug'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(set);
    expect(addLabelsFn).toHaveBeenCalledWith({
      repo: allowed,
      issueNumber: 3,
      labels: ['bug'],
    });
  });

  it('removeLabel forwards the label name to the port', async () => {
    const removeLabelFn = vi.fn().mockResolvedValue({ labels: [] });
    const port = fakePort({ removeLabel: removeLabelFn });
    const result = await removeLabel(port)({
      ...allowed,
      issueNumber: 3,
      label: 'bug',
    });
    expect(result.ok).toBe(true);
    expect(removeLabelFn).toHaveBeenCalledWith({
      repo: allowed,
      issueNumber: 3,
      label: 'bug',
    });
  });

  it('addAssignees forwards the assignees to the port', async () => {
    const addAssigneesFn = vi
      .fn()
      .mockResolvedValue({ assignees: ['octocat'] });
    const port = fakePort({ addAssignees: addAssigneesFn });
    const result = await addAssignees(port)({
      ...allowed,
      issueNumber: 7,
      assignees: ['octocat'],
    });
    expect(result.ok).toBe(true);
    expect(addAssigneesFn).toHaveBeenCalledWith({
      repo: allowed,
      issueNumber: 7,
      assignees: ['octocat'],
    });
  });

  it('setMilestone and clearMilestone forward to the port', async () => {
    const setFn = vi
      .fn()
      .mockResolvedValue({ milestone: { number: 2, title: 'v1' } });
    const clearFn = vi.fn().mockResolvedValue({ milestone: null });
    const port = fakePort({ setMilestone: setFn, clearMilestone: clearFn });

    await setMilestone(port)({ ...allowed, issueNumber: 4, milestone: 2 });
    await clearMilestone(port)({ ...allowed, issueNumber: 4 });

    expect(setFn).toHaveBeenCalledWith({
      repo: allowed,
      issueNumber: 4,
      milestone: 2,
    });
    expect(clearFn).toHaveBeenCalledWith({ repo: allowed, issueNumber: 4 });
  });
});
