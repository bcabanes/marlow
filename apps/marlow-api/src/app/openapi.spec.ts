import { GitHubRepositoryPort } from '@org/marlow-application';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { app } from './app';
import { AppConfig } from './config';
import { AppDependencies } from './dependencies';
import { buildOpenApiDocument } from './openapi';

const config: AppConfig = {
  host: '127.0.0.1',
  port: 0,
  exposeInternalErrors: true,
  githubToken: 'ghp_test',
  github: {},
};

const deps: AppDependencies = {
  config,
  getGitHubPort: async () => ({}) as GitHubRepositoryPort,
};

// Fastify path -> OpenAPI path: `:param` -> `{param}`, trailing `*` -> `{path}`.
const toOpenApiPath = (url: string): string =>
  url.replace(/\/\*$/, '/{path}').replace(/:([^/]+)/g, '{$1}');

describe('openapi document', () => {
  it('documents exactly the routes the app registers', async () => {
    const server = Fastify();
    const registered = new Set<string>();
    const documentedMethods = new Set([
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
    ]);
    server.addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        if (documentedMethods.has(method)) {
          registered.add(`${method} ${toOpenApiPath(route.url)}`);
        }
      }
    });
    await server.register(app, { deps });
    await server.ready();
    await server.close();

    const doc = buildOpenApiDocument();
    const documented = new Set<string>();
    for (const [path, operations] of Object.entries(doc.paths)) {
      for (const method of Object.keys(operations)) {
        documented.add(`${method.toUpperCase()} ${path}`);
      }
    }

    expect([...documented].sort()).toEqual([...registered].sort());
  });

  it('is a structurally valid OpenAPI 3.1 document', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBeTruthy();
    expect(doc.components.schemas.Error).toBeTruthy();
    for (const operations of Object.values(doc.paths)) {
      for (const operation of Object.values(operations)) {
        const responses = (operation as { responses: Record<string, unknown> })
          .responses;
        expect(responses.default).toBeTruthy();
      }
    }
  });
});
