import { getFileContents, listTree, searchCode } from '@org/marlow-application';
import {
  fileContentsQuerySchema,
  paginationQuerySchema,
  repoParamsSchema,
  treeQuerySchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

const contentsParamsSchema = repoParamsSchema.extend({
  '*': z.string().min(1),
});
const searchQuerySchema = paginationQuerySchema.extend({
  query: z.string().min(1),
});

export const registerContentsRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/tree', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { ref, recursive } = treeQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(await listTree(port)({ owner, repo, ref, recursive }));
  });

  fastify.get('/repos/:owner/:repo/contents/*', async (request) => {
    const params = contentsParamsSchema.parse(request.params);
    const { ref } = fileContentsQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await getFileContents(port)({
        owner: params.owner,
        repo: params.repo,
        path: params['*'],
        ref,
      }),
    );
  });

  fastify.get('/repos/:owner/:repo/search/code', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { query, page, perPage } = searchQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await searchCode(port)({ owner, repo, query, page, perPage }),
    );
  });
};
