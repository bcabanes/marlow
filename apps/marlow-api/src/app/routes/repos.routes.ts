import { checkPermissions, listRepos } from '@org/marlow-application';
import { repoParamsSchema } from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerReposRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos', async () => listRepos());

  fastify.get('/repos/:owner/:repo/permissions', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const port = await deps.getGitHubPort();
    return unwrapResult(await checkPermissions(port)({ owner, repo }));
  });
};
