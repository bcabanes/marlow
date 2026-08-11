import {
  addPullRequestsToStack,
  createPullRequestStack,
  getPullRequestMergeResult,
  getPullRequestStack,
  listPullRequestStacks,
  mergePullRequestAsync,
  unstackPullRequests,
} from '@org/marlow-application';
import {
  addPullRequestsToStackBodySchema,
  confirmBodySchema,
  createPullRequestStackBodySchema,
  listPullRequestStacksQuerySchema,
  mergePullRequestAsyncBodySchema,
  pullRequestMergeResultParamsSchema,
  pullRequestStackParamsSchema,
  pullNumberParamsSchema,
  repoParamsSchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerStackedPullsRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/stacks', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { pullNumber, page, perPage } =
      listPullRequestStacksQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await listPullRequestStacks(port)({
        owner,
        repo,
        pullNumber,
        page,
        perPage,
      }),
    );
  });

  fastify.get('/repos/:owner/:repo/stacks/:stackNumber', async (request) => {
    const { owner, repo, stackNumber } = pullRequestStackParamsSchema.parse(
      request.params,
    );
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await getPullRequestStack(port)({ owner, repo, stackNumber }),
    );
  });

  fastify.post('/repos/:owner/:repo/stacks', async (request, reply) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { pullNumbers } = createPullRequestStackBodySchema.parse(
      request.body,
    );
    const port = await deps.getGitHubPort();
    const stack = unwrapResult(
      await createPullRequestStack(port)({ owner, repo, pullNumbers }),
    );
    reply.code(201);
    return stack;
  });

  fastify.post(
    '/repos/:owner/:repo/stacks/:stackNumber/add',
    async (request) => {
      const { owner, repo, stackNumber } = pullRequestStackParamsSchema.parse(
        request.params,
      );
      const { pullNumbers } = addPullRequestsToStackBodySchema.parse(
        request.body,
      );
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await addPullRequestsToStack(port)({
          owner,
          repo,
          stackNumber,
          pullNumbers,
        }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/stacks/:stackNumber/unstack',
    async (request) => {
      const { owner, repo, stackNumber } = pullRequestStackParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await unstackPullRequests(port)({ owner, repo, stackNumber }),
      );
    },
  );

  fastify.put(
    '/repos/:owner/:repo/pulls/:pullNumber/merge-async',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = mergePullRequestAsyncBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await mergePullRequestAsync(port)({
          owner,
          repo,
          pullNumber,
          mergeMethod: body.mergeMethod,
          mergeAction: body.mergeAction,
          commitTitle: body.commitTitle,
          commitMessage: body.commitMessage,
          expectedHeadSha: body.expectedHeadSha,
        }),
      );
    },
  );

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/merge-async/:mergeId',
    async (request) => {
      const { owner, repo, pullNumber, mergeId } =
        pullRequestMergeResultParamsSchema.parse(request.params);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await getPullRequestMergeResult(port)({
          owner,
          repo,
          pullNumber,
          mergeId,
        }),
      );
    },
  );
};
