import {
  compareCommits,
  getCommit,
  listCommits,
} from '@org/marlow-application';
import {
  commitShaParamsSchema,
  listCommitsQuerySchema,
  paginationQuerySchema,
  repoParamsSchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

// `BASE...HEAD` sides are often branch names with slashes, so the route takes
// the rest of the path as a wildcard.
const compareParamsSchema = repoParamsSchema.extend({
  '*': z.string().min(1),
});

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

  fastify.get('/repos/:owner/:repo/compare/*', async (request) => {
    const params = compareParamsSchema.parse(request.params);
    const { page, perPage } = paginationQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await compareCommits(port)({
        owner: params.owner,
        repo: params.repo,
        basehead: params['*'],
        page,
        perPage,
      }),
    );
  });
};
