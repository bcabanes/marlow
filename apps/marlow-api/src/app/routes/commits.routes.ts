import { getCommit, listCommits } from '@org/marlow-application';
import {
  commitShaParamsSchema,
  listCommitsQuerySchema,
  repoParamsSchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerCommitsRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/commits', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { ref, path, page, perPage } = listCommitsQuerySchema.parse(
      request.query,
    );
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await listCommits(port)({ owner, repo, ref, path, page, perPage }),
    );
  });

  fastify.get('/repos/:owner/:repo/commits/:sha', async (request) => {
    const { owner, repo, sha } = commitShaParamsSchema.parse(request.params);
    const port = await deps.getGitHubPort();
    return unwrapResult(await getCommit(port)({ owner, repo, sha }));
  });
};
