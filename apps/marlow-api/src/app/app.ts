import sensible from '@fastify/sensible';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from './dependencies';
import { registerErrorHandler } from './error-handler';
import { registerCommitsRoutes } from './routes/commits.routes';
import { registerContentsRoutes } from './routes/contents.routes';
import { registerHealthRoutes } from './routes/health.routes';
import { registerIssuesRoutes } from './routes/issues.routes';
import { registerOpenApiRoutes } from './routes/openapi.routes';
import { registerPullsRoutes } from './routes/pulls.routes';
import { registerReposRoutes } from './routes/repos.routes';
import { registerStatusesRoutes } from './routes/statuses.routes';

export interface AppOptions {
  readonly deps: AppDependencies;
}

export async function app(
  fastify: FastifyInstance,
  opts: AppOptions,
): Promise<void> {
  await fastify.register(sensible);

  registerErrorHandler(fastify, opts.deps);

  registerHealthRoutes(fastify);
  registerOpenApiRoutes(fastify);
  registerReposRoutes(fastify, opts.deps);
  registerContentsRoutes(fastify, opts.deps);
  registerCommitsRoutes(fastify, opts.deps);
  registerIssuesRoutes(fastify, opts.deps);
  registerPullsRoutes(fastify, opts.deps);
  registerStatusesRoutes(fastify, opts.deps);
}
