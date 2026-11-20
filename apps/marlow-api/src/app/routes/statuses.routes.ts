import {
  getCombinedStatus,
  getPullRequestChecks,
  listCheckRuns,
  rerunCheckRun,
} from '@org/marlow-application';
import {
  checkRunParamsSchema,
  confirmBodySchema,
  pullNumberParamsSchema,
  repoParamsSchema,
  statusRefQuerySchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerStatusesRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/commit-status', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { ref } = statusRefQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(await getCombinedStatus(port)({ owner, repo, ref }));
  });

  fastify.get('/repos/:owner/:repo/check-runs', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { ref } = statusRefQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(await listCheckRuns(port)({ owner, repo, ref }));
  });

  fastify.post(
    '/repos/:owner/:repo/check-runs/:checkRunId/rerequest',
    async (request) => {
      const { owner, repo, checkRunId } = checkRunParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await rerunCheckRun(port)({ owner, repo, checkRunId }),
      );
    },
  );

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/checks',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await getPullRequestChecks(port)({ owner, repo, pullNumber }),
      );
    },
  );
};
