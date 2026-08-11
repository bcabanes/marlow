import { GitHubPortError } from '@org/marlow-application';
import type {
  FilePath,
  GitRef,
  GitSha,
  IssueNumber,
  PullRequestNumber,
  RepoRef,
  ReviewCommentId,
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
  it('maps headSha from pull list, detail, create, and update responses', async () => {
    const pull = {
      number: 42,
      title: 'A change',
      state: 'open',
      body: null,
      user: { login: 'octocat' },
      head: { ref: 'feature', sha: 'a'.repeat(40) },
      base: { ref: 'main' },
      draft: false,
      merged_at: null,
      labels: [],
      assignees: [],
      milestone: null,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-02T00:00:00Z',
    };
    const list = vi.fn().mockResolvedValue({ data: [pull] });
    const get = vi.fn().mockResolvedValue({ data: pull });
    const create = vi.fn().mockResolvedValue({ data: pull });
    const update = vi.fn().mockResolvedValue({ data: pull });
    const octokit = {
      rest: { pulls: { list, get, create, update } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const listed = await adapter.listPullRequests({ repo, state: 'open' });
    const detailed = await adapter.getPullRequest({
      repo,
      pullNumber: 42 as PullRequestNumber,
    });
    const created = await adapter.createPullRequest({
      repo,
      title: 'A change',
      head: 'feature' as GitRef,
      base: 'main' as GitRef,
    });
    const updated = await adapter.updatePullRequest({
      repo,
      pullNumber: 42 as PullRequestNumber,
      title: 'A revised change',
    });

    expect(listed[0].headSha).toBe('a'.repeat(40));
    expect(detailed.headSha).toBe('a'.repeat(40));
    expect(created.headSha).toBe('a'.repeat(40));
    expect(updated.headSha).toBe('a'.repeat(40));
  });

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

  it('returns body-less issue summaries that never leak raw fields', async () => {
    const listForRepo = vi.fn().mockResolvedValue({
      data: [
        {
          ...baseIssue(5),
          body: 'a long body that should not ride along in a list response',
          secret_internal_field: 'should-not-appear',
        },
      ],
    });
    const octokit = {
      rest: { issues: { listForRepo } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const issues = await adapter.listIssues({ repo, state: 'open' });

    expect(issues[0]).not.toHaveProperty('body');
    expect(JSON.stringify(issues)).not.toContain('secret_internal_field');
    expect(JSON.stringify(issues)).not.toContain('a long body');
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
        head: { ref: 'feature', sha: 'a'.repeat(40) },
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
    expect(pull.headSha).toBe('a'.repeat(40));
  });

  it('surfaces requested reviewers and teams as separate arrays', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 42,
        title: 'A change',
        state: 'open',
        body: null,
        user: { login: 'octocat' },
        head: { ref: 'feature', sha: 'b'.repeat(40) },
        base: { ref: 'main' },
        draft: false,
        merged_at: null,
        labels: [],
        assignees: [],
        requested_reviewers: [{ login: 'reviewer-1' }, { login: 'reviewer-2' }],
        requested_teams: [{ slug: 'platform' }],
        milestone: null,
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

    expect(pull.requestedReviewers).toEqual(['reviewer-1', 'reviewer-2']);
    expect(pull.requestedTeams).toEqual(['platform']);
    expect(pull.headSha).toBe('b'.repeat(40));
  });

  it('maps pull request reviews to reviewer, state, note, and timestamp', async () => {
    const listReviews = vi.fn().mockResolvedValue({
      data: [
        {
          id: 901,
          user: { login: 'octocat' },
          state: 'CHANGES_REQUESTED',
          body: 'Please rename this',
          submitted_at: '2020-01-03T00:00:00Z',
          secret_internal_field: 'should-not-appear',
        },
        {
          id: 902,
          user: null,
          state: 'APPROVED',
          body: '',
          submitted_at: null,
        },
      ],
    });
    const octokit = {
      rest: { pulls: { listReviews } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const reviews = await adapter.listPullRequestReviews({
      repo,
      pullNumber: 42 as PullRequestNumber,
    });

    expect(reviews[0]).toEqual({
      id: 901,
      author: 'octocat',
      state: 'CHANGES_REQUESTED',
      body: 'Please rename this',
      submittedAt: '2020-01-03T00:00:00Z',
    });
    expect(reviews[1].author).toBeNull();
    expect(reviews[1].submittedAt).toBeNull();
    expect(JSON.stringify(reviews)).not.toContain('secret_internal_field');
    expect(listReviews).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
    });
  });

  it('reads pull request comments from the review-comments endpoint with their diff anchor', async () => {
    const listReviewComments = vi.fn().mockResolvedValue({
      data: [
        {
          id: 555,
          user: { login: 'octocat' },
          body: 'Unnecessary variable declaration',
          path: 'apps/web/task-details.tsx',
          line: 166,
          original_line: 160,
          side: 'RIGHT',
          start_line: null,
          start_side: null,
          diff_hunk: '@@ -163,6 +163,7 @@',
          commit_id: 'deadbeef',
          original_commit_id: 'cafef00d',
          in_reply_to_id: null,
          pull_request_review_id: 901,
          html_url: 'https://github.com/nrwl/nx/pull/42#discussion_r555',
          subject_type: 'line',
          created_at: '2020-01-03T00:00:00Z',
          updated_at: '2020-01-03T00:00:00Z',
          secret_internal_field: 'should-not-appear',
        },
      ],
    });
    const octokit = {
      rest: { pulls: { listReviewComments } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const comments = await adapter.listPullRequestComments({
      repo,
      pullNumber: 42 as PullRequestNumber,
    });

    expect(comments[0]).toEqual({
      id: 555,
      author: 'octocat',
      body: 'Unnecessary variable declaration',
      path: 'apps/web/task-details.tsx',
      line: 166,
      originalLine: 160,
      side: 'RIGHT',
      startLine: null,
      startSide: null,
      diffHunk: '@@ -163,6 +163,7 @@',
      commitId: 'deadbeef',
      originalCommitId: 'cafef00d',
      inReplyToId: null,
      pullRequestReviewId: 901,
      htmlUrl: 'https://github.com/nrwl/nx/pull/42#discussion_r555',
      subjectType: 'line',
      createdAt: '2020-01-03T00:00:00Z',
      updatedAt: '2020-01-03T00:00:00Z',
    });
    expect(JSON.stringify(comments)).not.toContain('secret_internal_field');
    expect(listReviewComments).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
    });
  });

  it('creates an immediate range review comment with modern line anchors', async () => {
    const createReviewComment = vi
      .fn()
      .mockResolvedValue({ data: baseReviewComment(556) });
    const octokit = {
      rest: { pulls: { createReviewComment } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const comment = await adapter.createPullRequestReviewComment({
      repo,
      pullNumber: 42 as PullRequestNumber,
      body: 'Please rename this',
      commitId: 'a'.repeat(40) as GitSha,
      target: {
        subjectType: 'line',
        path: 'src/index.ts' as FilePath,
        line: 12,
        side: 'RIGHT',
        startLine: 10,
        startSide: 'RIGHT',
      },
    });

    expect(comment.id).toBe(556);
    expect(JSON.stringify(comment)).not.toContain('secret_internal_field');
    expect(createReviewComment).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
      body: 'Please rename this',
      commit_id: 'a'.repeat(40),
      path: 'src/index.ts',
      subject_type: 'line',
      line: 12,
      side: 'RIGHT',
      start_line: 10,
      start_side: 'RIGHT',
    });
  });

  it('creates a file review comment without line fields', async () => {
    const createReviewComment = vi
      .fn()
      .mockResolvedValue({ data: baseReviewComment(557, 'file') });
    const adapter = createGitHubRepositoryAdapter({
      rest: { pulls: { createReviewComment } },
    } as unknown as Octokit);

    await adapter.createPullRequestReviewComment({
      repo,
      pullNumber: 42 as PullRequestNumber,
      body: 'This file needs documentation',
      commitId: 'a'.repeat(40) as GitSha,
      target: {
        subjectType: 'file',
        path: 'src/index.ts' as FilePath,
      },
    });

    expect(createReviewComment).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
      body: 'This file needs documentation',
      commit_id: 'a'.repeat(40),
      path: 'src/index.ts',
      subject_type: 'file',
    });
  });

  it('replies through the dedicated top-level review-comment endpoint', async () => {
    const createReplyForReviewComment = vi
      .fn()
      .mockResolvedValue({ data: baseReviewComment(558) });
    const adapter = createGitHubRepositoryAdapter({
      rest: { pulls: { createReplyForReviewComment } },
    } as unknown as Octokit);

    const reply = await adapter.createPullRequestReviewCommentReply({
      repo,
      pullNumber: 42 as PullRequestNumber,
      commentId: 555 as ReviewCommentId,
      body: 'Agreed',
    });

    expect(reply.id).toBe(558);
    expect(createReplyForReviewComment).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
      comment_id: 555,
      body: 'Agreed',
    });
  });

  it('submits a grouped review and omits an absent commit ID', async () => {
    const createReview = vi.fn().mockResolvedValue({
      data: {
        id: 903,
        user: { login: 'octocat' },
        state: 'COMMENTED',
        body: 'Summary',
        submitted_at: '2020-01-03T00:00:00Z',
      },
    });
    const adapter = createGitHubRepositoryAdapter({
      rest: { pulls: { createReview } },
    } as unknown as Octokit);

    const review = await adapter.createPullRequestReview({
      repo,
      pullNumber: 42 as PullRequestNumber,
      event: 'COMMENT',
      body: 'Summary',
      comments: [
        {
          body: 'Inline',
          path: 'src/index.ts' as FilePath,
          line: 12,
          side: 'RIGHT',
          startLine: 10,
          startSide: 'RIGHT',
        },
      ],
    });

    expect(review).toEqual({
      id: 903,
      author: 'octocat',
      state: 'COMMENTED',
      body: 'Summary',
      submittedAt: '2020-01-03T00:00:00Z',
    });
    expect(createReview).toHaveBeenCalledWith({
      owner: 'nrwl',
      repo: 'nx',
      pull_number: 42,
      event: 'COMMENT',
      body: 'Summary',
      comments: [
        {
          body: 'Inline',
          path: 'src/index.ts',
          line: 12,
          side: 'RIGHT',
          start_line: 10,
          start_side: 'RIGHT',
        },
      ],
    });
  });

  it('surfaces the commit and changed-file counts on a pull request', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 42,
        title: 'A change',
        state: 'open',
        body: null,
        user: { login: 'octocat' },
        head: { ref: 'feature', sha: 'c'.repeat(40) },
        base: { ref: 'main' },
        draft: false,
        merged_at: null,
        labels: [],
        assignees: [],
        milestone: null,
        commits: 3,
        changed_files: 7,
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

    expect(pull.commits).toBe(3);
    expect(pull.changedFiles).toBe(7);
  });

  it('reduces each listed commit message to its subject headline', async () => {
    const actor = {
      name: 'Octo',
      email: 'octo@example.com',
      date: '2020-01-01T00:00:00Z',
    };
    const listCommits = vi.fn().mockResolvedValue({
      data: [
        {
          sha: 'abc123',
          commit: {
            message:
              'Fix the thing\n\nA long explanatory body that should not appear in a list.',
            author: actor,
            committer: actor,
          },
        },
      ],
    });
    const octokit = {
      rest: { repos: { listCommits } },
    } as unknown as Octokit;
    const adapter = createGitHubRepositoryAdapter(octokit);

    const commits = await adapter.listCommits({ repo });

    expect(commits[0].messageHeadline).toBe('Fix the thing');
    expect(commits[0]).not.toHaveProperty('message');
    expect(JSON.stringify(commits)).not.toContain('explanatory body');
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

function baseReviewComment(id: number, subjectType = 'line') {
  return {
    id,
    user: { login: 'octocat' },
    body: 'Review comment',
    path: 'src/index.ts',
    line: subjectType === 'file' ? null : 12,
    original_line: subjectType === 'file' ? null : 12,
    side: subjectType === 'file' ? null : 'RIGHT',
    start_line: null,
    start_side: null,
    diff_hunk: '@@ -10,3 +10,3 @@',
    commit_id: 'a'.repeat(40),
    original_commit_id: 'a'.repeat(40),
    in_reply_to_id: null,
    pull_request_review_id: 901,
    html_url: `https://github.com/nrwl/nx/pull/42#discussion_r${id}`,
    subject_type: subjectType,
    created_at: '2020-01-03T00:00:00Z',
    updated_at: '2020-01-03T00:00:00Z',
    secret_internal_field: 'should-not-appear',
  };
}
