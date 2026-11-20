import { GitHubPortError, GitHubRepositoryPort } from '@org/marlow-application';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './app';
import { buildCheatSheet } from './cheatsheet';
import { AppConfig } from './config';
import { AppDependencies } from './dependencies';

const config: AppConfig = {
  host: '127.0.0.1',
  port: 0,
  exposeInternalErrors: true,
  githubToken: 'ghp_test',
  github: {},
};

const buildDeps = (
  port: Partial<GitHubRepositoryPort> = {},
): AppDependencies => ({
  config,
  getGitHubPort: async () => port as GitHubRepositoryPort,
});

describe('marlow-api', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    await server.close();
  });

  const start = async (deps: AppDependencies) => {
    server = Fastify();
    await server.register(app, { deps });
    await server.ready();
  };

  it('reports health', async () => {
    await start(buildDeps());
    const response = await server.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('serves the route index as Markdown at GET /', async () => {
    await start(buildDeps());
    const response = await server.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.body).toBe(buildCheatSheet());
    expect(response.body).toContain(
      'GET /repos/{owner}/{repo}/pulls/{pullNumber}/checks',
    );
  });

  it.each([
    ['/docs', '/'],
    ['/help', '/'],
    ['/routes', '/'],
    ['/api', '/'],
    ['/healthz', '/health'],
  ])('redirects the guessed path %s to %s', async (url, location) => {
    await start(buildDeps());
    const response = await server.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(location);
  });

  it('lists exactly the allow-listed repositories', async () => {
    await start(buildDeps());
    const response = await server.inject({ method: 'GET', url: '/repos' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { owner: 'nrwl', repo: 'ocean', fullName: 'nrwl/ocean' },
      { owner: 'nrwl', repo: 'nx', fullName: 'nrwl/nx' },
    ]);
  });

  it('rejects a disallowed repository with 403 and never calls GitHub', async () => {
    const checkPermissions = vi.fn();
    await start(buildDeps({ checkPermissions }));
    const response = await server.inject({
      method: 'GET',
      url: '/repos/evil/repo/permissions',
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('repo_not_allowed');
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('rejects a write without confirm: true and never calls GitHub', async () => {
    const createIssue = vi.fn();
    await start(buildDeps({ createIssue }));
    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/issues',
      payload: { title: 'hello' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
    expect(createIssue).not.toHaveBeenCalled();
  });

  it('creates an issue (201) when confirm: true', async () => {
    const issue = {
      number: 1,
      title: 'hello',
      state: 'open',
      body: null,
      author: 'octocat',
      labels: [],
      commentCount: 0,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    };
    const createIssue = vi.fn().mockResolvedValue(issue);
    await start(buildDeps({ createIssue }));
    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/issues',
      payload: { confirm: true, title: 'hello' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(issue);
    expect(createIssue).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      title: 'hello',
      body: undefined,
      labels: undefined,
    });
  });

  it('edits an issue (PATCH) when confirm: true', async () => {
    const updated = {
      number: 7,
      title: 'Edited',
      state: 'open',
      body: null,
      author: 'octocat',
      labels: [],
      commentCount: 0,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-02T00:00:00Z',
    };
    const updateIssue = vi.fn().mockResolvedValue(updated);
    await start(buildDeps({ updateIssue }));
    const response = await server.inject({
      method: 'PATCH',
      url: '/repos/nrwl/nx/issues/7',
      payload: { confirm: true, title: 'Edited' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
    expect(updateIssue).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 7,
      title: 'Edited',
      body: undefined,
      state: undefined,
      stateReason: undefined,
    });
  });

  it('adds labels to an issue (POST) when confirm: true', async () => {
    const addLabels = vi.fn().mockResolvedValue({ labels: ['bug'] });
    await start(buildDeps({ addLabels }));
    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/issues/7/labels',
      payload: { confirm: true, labels: ['bug'] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ labels: ['bug'] });
    expect(addLabels).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 7,
      labels: ['bug'],
    });
  });

  it('removes a label from an issue via DELETE with a confirm body', async () => {
    const removeLabel = vi.fn().mockResolvedValue({ labels: [] });
    await start(buildDeps({ removeLabel }));
    const response = await server.inject({
      method: 'DELETE',
      url: '/repos/nrwl/nx/issues/7/labels/bug',
      payload: { confirm: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ labels: [] });
    expect(removeLabel).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 7,
      label: 'bug',
    });
  });

  it('sets a milestone via PUT and clears it via DELETE', async () => {
    const setMilestone = vi
      .fn()
      .mockResolvedValue({ milestone: { number: 2, title: 'v1' } });
    const clearMilestone = vi.fn().mockResolvedValue({ milestone: null });
    await start(buildDeps({ setMilestone, clearMilestone }));

    const put = await server.inject({
      method: 'PUT',
      url: '/repos/nrwl/nx/issues/7/milestone',
      payload: { confirm: true, milestone: 2 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ milestone: { number: 2, title: 'v1' } });
    expect(setMilestone).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 7,
      milestone: 2,
    });

    const del = await server.inject({
      method: 'DELETE',
      url: '/repos/nrwl/nx/issues/7/milestone',
      payload: { confirm: true },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ milestone: null });
    expect(clearMilestone).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 7,
    });
  });

  it('manages PR labels through the pull number as an issue number', async () => {
    const removeLabel = vi.fn().mockResolvedValue({ labels: [] });
    await start(buildDeps({ removeLabel }));
    const response = await server.inject({
      method: 'DELETE',
      url: '/repos/nrwl/nx/pulls/42/labels/wip',
      payload: { confirm: true },
    });
    expect(response.statusCode).toBe(200);
    expect(removeLabel).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      issueNumber: 42,
      label: 'wip',
    });
  });

  it('creates an immediate pull-request review comment (201)', async () => {
    const comment = reviewComment(555);
    const createPullRequestReviewComment = vi.fn().mockResolvedValue(comment);
    await start(buildDeps({ createPullRequestReviewComment }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/comments',
      payload: {
        confirm: true,
        body: 'Please rename this',
        commitId: 'a'.repeat(40),
        path: 'src/index.ts',
        line: 12,
        side: 'RIGHT',
        startLine: 10,
        startSide: 'RIGHT',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(comment);
    expect(createPullRequestReviewComment).toHaveBeenCalledWith({
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

  it('creates a review-comment reply (201)', async () => {
    const comment = reviewComment(556);
    const createPullRequestReviewCommentReply = vi
      .fn()
      .mockResolvedValue(comment);
    await start(buildDeps({ createPullRequestReviewCommentReply }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/comments/555/replies',
      payload: { confirm: true, body: 'Agreed' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(comment);
    expect(createPullRequestReviewCommentReply).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      commentId: 555,
      body: 'Agreed',
    });
  });

  it('submits a grouped pull-request review (200)', async () => {
    const review = {
      id: 901,
      author: 'octocat',
      state: 'COMMENTED',
      body: 'Summary',
      submittedAt: '2020-01-01T00:00:00Z',
      htmlUrl: 'https://github.com/nrwl/nx/pull/42#pullrequestreview-901',
    };
    const createPullRequestReview = vi.fn().mockResolvedValue(review);
    await start(buildDeps({ createPullRequestReview }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/reviews',
      payload: {
        confirm: true,
        event: 'COMMENT',
        body: 'Summary',
        comments: [
          {
            body: 'Inline',
            path: 'src/index.ts',
            line: 12,
            side: 'RIGHT',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(review);
    expect(createPullRequestReview).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      event: 'COMMENT',
      body: 'Summary',
      comments: [
        {
          body: 'Inline',
          path: 'src/index.ts',
          line: 12,
          side: 'RIGHT',
          startLine: undefined,
          startSide: undefined,
        },
      ],
    });
  });

  it('creates a pending review with multiple inline comments when event is omitted', async () => {
    const review = {
      id: 902,
      author: 'octocat',
      state: 'PENDING',
      body: null,
      submittedAt: null,
      htmlUrl: 'https://github.com/nrwl/nx/pull/42#pullrequestreview-902',
    };
    const createPullRequestReview = vi.fn().mockResolvedValue(review);
    await start(buildDeps({ createPullRequestReview }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/reviews',
      payload: {
        confirm: true,
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
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(review);
    expect(createPullRequestReview).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      event: 'PENDING',
      commitId: undefined,
      body: undefined,
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

  it('returns a clear conflict when the authenticated user has a pending review', async () => {
    const createPullRequestReview = vi
      .fn()
      .mockRejectedValue(
        new GitHubPortError(
          'pending_review_exists',
          'GitHub rejected the review because a pending review already exists',
          { status: 422 },
        ),
      );
    await start(buildDeps({ createPullRequestReview }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/reviews',
      payload: { confirm: true, event: 'PENDING' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'conflict',
        message:
          'Authenticated GitHub user already has a pending review for this pull request',
      },
    });
  });

  it('strictly rejects unsupported review-comment fields before GitHub', async () => {
    const createPullRequestReviewComment = vi.fn();
    await start(buildDeps({ createPullRequestReviewComment }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/comments',
      payload: {
        confirm: true,
        body: 'Please rename this',
        commitId: 'a'.repeat(40),
        path: 'src/index.ts',
        position: 4,
        line: 12,
        side: 'RIGHT',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
    expect(createPullRequestReviewComment).not.toHaveBeenCalled();
  });

  it('sanitizes GitHub validation failures from review-comment writes', async () => {
    const createPullRequestReviewComment = vi
      .fn()
      .mockRejectedValue(
        new GitHubPortError(
          'validation_failed',
          'raw provider validation mentions ghp_secret',
          { status: 422 },
        ),
      );
    await start(buildDeps({ createPullRequestReviewComment }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/pulls/42/comments',
      payload: {
        confirm: true,
        body: 'Please rename this',
        commitId: 'a'.repeat(40),
        path: 'src/index.ts',
        line: 12,
        side: 'RIGHT',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: 'GitHub rejected the request',
      },
    });
    expect(response.body).not.toContain('ghp_secret');
  });

  it("returns GitHub's rejection detail in production mode", async () => {
    const upstream = {
      message: 'Validation Failed',
      errors: [
        {
          resource: 'PullRequest',
          field: 'base',
          code: 'invalid',
          message: 'base is not a branch',
        },
      ],
    };
    const updatePullRequest = vi.fn().mockRejectedValue(
      new GitHubPortError('validation_failed', 'raw ghp_secret', {
        status: 422,
        upstream,
      }),
    );
    await start({
      config: { ...config, exposeInternalErrors: false },
      getGitHubPort: async () =>
        ({ updatePullRequest }) as unknown as GitHubRepositoryPort,
    });

    const response = await server.inject({
      method: 'PATCH',
      url: '/repos/nrwl/nx/pulls/42',
      payload: { confirm: true, base: 'missing' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: 'GitHub rejected the request',
        details: { github: upstream },
      },
    });
    expect(response.body).not.toContain('ghp_secret');
  });

  it('marks a draft pull request ready for review via PATCH draft: false', async () => {
    const updatePullRequest = vi
      .fn()
      .mockResolvedValue({ number: 42, draft: false });
    await start(buildDeps({ updatePullRequest }));

    const response = await server.inject({
      method: 'PATCH',
      url: '/repos/nrwl/nx/pulls/42',
      payload: { confirm: true, draft: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ number: 42, draft: false });
    expect(updatePullRequest).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      title: undefined,
      body: undefined,
      base: undefined,
      draft: false,
    });
  });

  it('rejects a pull-request PATCH that changes nothing', async () => {
    const updatePullRequest = vi.fn();
    await start(buildDeps({ updatePullRequest }));

    const response = await server.inject({
      method: 'PATCH',
      url: '/repos/nrwl/nx/pulls/42',
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
    expect(updatePullRequest).not.toHaveBeenCalled();
  });

  it('re-runs a check run when confirm: true and reports which call ran', async () => {
    const rerun = { via: 'actions_job_rerun', checkRunId: 11, jobId: 11 };
    const rerunCheckRun = vi.fn().mockResolvedValue(rerun);
    await start(buildDeps({ rerunCheckRun }));

    const response = await server.inject({
      method: 'POST',
      url: '/repos/nrwl/nx/check-runs/11/rerequest',
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(rerun);
    expect(rerunCheckRun).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      checkRunId: 11,
    });
  });

  it('filters commit history by path and accepts sha as the branch filter', async () => {
    const listCommits = vi.fn().mockResolvedValue([]);
    await start(buildDeps({ listCommits }));

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/commits?sha=release%2F1.x&path=libs%2Fa.ts',
    });

    expect(response.statusCode).toBe(200);
    expect(listCommits).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      ref: 'release/1.x',
      path: 'libs/a.ts',
      page: undefined,
      perPage: 30,
    });
  });

  it('compares BASE...HEAD where the head branch contains slashes', async () => {
    const comparison = {
      status: 'ahead',
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 1,
      commits: [],
      files: [],
    };
    const compareCommits = vi.fn().mockResolvedValue(comparison);
    await start(buildDeps({ compareCommits }));

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/compare/main...feat/compare-route?perPage=5',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(comparison);
    expect(compareCommits).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      range: { base: 'main', head: 'feat/compare-route' },
      page: undefined,
      perPage: 5,
    });
  });

  it('rejects a compare path without BASE...HEAD before GitHub', async () => {
    const compareCommits = vi.fn();
    await start(buildDeps({ compareCommits }));

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/compare/main',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
    expect(compareCommits).not.toHaveBeenCalled();
  });

  it('pages pull-request files and says whether another page exists', async () => {
    const filePage = { files: [], page: 2, perPage: 100, nextPage: 3 };
    const listPullRequestFiles = vi.fn().mockResolvedValue(filePage);
    await start(buildDeps({ listPullRequestFiles }));

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/pulls/42/files?page=2&perPage=100',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(filePage);
    expect(listPullRequestFiles).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      pullNumber: 42,
      page: 2,
      perPage: 100,
    });
  });

  it('keeps 100 as the pull-request files page-size cap', async () => {
    const listPullRequestFiles = vi.fn();
    await start(buildDeps({ listPullRequestFiles }));

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/pulls/42/files?perPage=101',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
    expect(listPullRequestFiles).not.toHaveBeenCalled();
  });

  it("returns CI for a pull request's current head commit", async () => {
    const headSha = 'c'.repeat(40);
    const checkRun = {
      id: 11,
      name: 'lint',
      status: 'completed',
      conclusion: 'failure',
      app: 'github-actions',
      detailsUrl: 'https://github.com/nrwl/nx/actions/runs/1/job/11',
      startedAt: '2020-01-01T00:00:00Z',
      completedAt: '2020-01-01T00:05:00Z',
      title: 'Lint failed',
      summary: '1 error',
      summaryTruncated: false,
    };
    const combinedStatus = { state: 'success', totalCount: 0, statuses: [] };
    const getPullRequest = vi.fn().mockResolvedValue({ number: 42, headSha });
    const listCheckRuns = vi.fn().mockResolvedValue([checkRun]);
    const getCombinedStatus = vi.fn().mockResolvedValue(combinedStatus);
    await start(
      buildDeps({ getPullRequest, listCheckRuns, getCombinedStatus }),
    );

    const response = await server.inject({
      method: 'GET',
      url: '/repos/nrwl/nx/pulls/42/checks',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      headSha,
      checkRuns: [checkRun],
      combinedStatus,
    });
    expect(listCheckRuns).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      ref: headSha,
    });
    expect(getCombinedStatus).toHaveBeenCalledWith({
      repo: { owner: 'nrwl', repo: 'nx' },
      ref: headSha,
    });
  });
});

const reviewComment = (id: number) => ({
  id,
  author: 'octocat',
  body: 'Review comment',
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
  htmlUrl: `https://github.com/nrwl/nx/pull/42#discussion_r${id}`,
  subjectType: 'line',
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
});
