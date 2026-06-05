import { GitHubRepositoryPort } from '@org/marlow-application';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './app';
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
});
