import { GitHubRepositoryPort } from '@org/marlow-application';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
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

// Throws if GitHub is reached; confirm-gating must reject before that.
const throwingPort = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error('GitHub port must not be called without confirm');
      };
    },
  },
) as unknown as GitHubRepositoryPort;

const deps: AppDependencies = {
  config,
  getGitHubPort: async () => throwingPort,
};

describe('write endpoints require confirm: true', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    await server.close();
  });

  const start = async () => {
    server = Fastify();
    await server.register(app, { deps });
    await server.ready();
  };

  it.each([
    ['/repos/nrwl/nx/issues', { title: 'x' }],
    ['/repos/nrwl/nx/issues/1/close', {}],
    ['/repos/nrwl/nx/issues/1/comments', { body: 'x' }],
    ['/repos/nrwl/nx/issues/1/labels', { labels: ['bug'] }],
    ['/repos/nrwl/nx/issues/1/assignees', { assignees: ['octocat'] }],
    ['/repos/nrwl/nx/pulls', { title: 'x', head: 'feature', base: 'main' }],
    ['/repos/nrwl/nx/pulls/1/close', {}],
    ['/repos/nrwl/nx/pulls/1/labels', { labels: ['bug'] }],
    ['/repos/nrwl/nx/pulls/1/assignees', { assignees: ['octocat'] }],
  ])('POST %s without confirm returns 400', async (url, payload) => {
    await start();
    const response = await server.inject({ method: 'POST', url, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it.each([
    ['PATCH', '/repos/nrwl/nx/issues/1', { title: 'x' }],
    ['DELETE', '/repos/nrwl/nx/issues/1/labels/bug', {}],
    ['DELETE', '/repos/nrwl/nx/issues/1/assignees', { assignees: ['octocat'] }],
    ['PUT', '/repos/nrwl/nx/issues/1/milestone', { milestone: 1 }],
    ['DELETE', '/repos/nrwl/nx/issues/1/milestone', {}],
    ['PATCH', '/repos/nrwl/nx/pulls/1', { body: 'updated' }],
    ['DELETE', '/repos/nrwl/nx/pulls/1/labels/bug', {}],
    ['DELETE', '/repos/nrwl/nx/pulls/1/assignees', { assignees: ['octocat'] }],
    ['PUT', '/repos/nrwl/nx/pulls/1/milestone', { milestone: 1 }],
    ['DELETE', '/repos/nrwl/nx/pulls/1/milestone', {}],
  ])('%s %s without confirm returns 400', async (method, url, payload) => {
    await start();
    const response = await server.inject({
      method: method as 'PATCH' | 'PUT' | 'DELETE',
      url: url as string,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('validation_failed');
  });
});
