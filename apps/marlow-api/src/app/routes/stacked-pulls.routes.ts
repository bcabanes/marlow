import {
  addPullRequestsToStack,
  createPullRequestStack,
  getPullRequestMergeResult,
  getPullRequestStack,
  listPullRequestStacks,
  mergePullRequestAsync,
  mergePullRequestStack,
  unstackPullRequests,
  type AsyncMergeSubmission,
} from '@org/marlow-application';
import {
  addPullRequestsToStackBodySchema,
  confirmBodySchema,
  createPullRequestStackBodySchema,
  listPullRequestStacksQuerySchema,
  mergePullRequestAsyncBodySchema,
  mergePullRequestStackBodySchema,
  pullRequestMergeResultParamsSchema,
  pullRequestStackParamsSchema,
  pullNumberParamsSchema,
  repoParamsSchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance, FastifyReply } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

const asyncMergeSubmissionStatus = (
  submission: AsyncMergeSubmission,
): 200 | 202 | 400 | 409 => {
  switch (submission.outcome) {
    case 'accepted':
      return 202;
    case 'completed':
      return 200;
    case 'rejected':
      return 400;
    case 'alreadyPending':
      return 409;
  }
};

const asyncMergeResponse = (
  owner: string,
  repo: string,
  pullNumber: number,
  submission: AsyncMergeSubmission,
) => ({
  ...submission,
  ...(submission.merge.status === 'pending'
    ? {
        next: {
          method: 'GET' as const,
          url: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/merge-async/${submission.merge.id}`,
        },
      }
    : {}),
});

const sendAsyncMergeSubmission = (
  reply: FastifyReply,
  owner: string,
  repo: string,
  pullNumber: number,
  submission: AsyncMergeSubmission,
) => {
  reply.code(asyncMergeSubmissionStatus(submission));
  return asyncMergeResponse(owner, repo, pullNumber, submission);
};

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
    async (request, reply) => {
      const { owner, repo, stackNumber } = pullRequestStackParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      const result = unwrapResult(
        await unstackPullRequests(port)({ owner, repo, stackNumber }),
      );
      if (result.outcome === 'dissolved') {
        return reply.code(204).send();
      }
      return result.stack;
    },
  );

  fastify.put(
    '/repos/:owner/:repo/stacks/:stackNumber/merge-async',
    async (request, reply) => {
      const { owner, repo, stackNumber } = pullRequestStackParamsSchema.parse(
        request.params,
      );
      const body = mergePullRequestStackBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      const result = unwrapResult(
        await mergePullRequestStack(port)({
          owner,
          repo,
          stackNumber,
          mergeMethod: body.mergeMethod,
          mergeAction: body.mergeAction,
          commitTitle: body.commitTitle,
          commitMessage: body.commitMessage,
          expectedHeadSha: body.expectedHeadSha,
        }),
      );

      if (result.outcome === 'blocked') {
        reply.code(409);
        return result;
      }
      if (result.outcome === 'complete') return result;

      reply.code(asyncMergeSubmissionStatus(result.submission));
      const submission = asyncMergeResponse(
        owner,
        repo,
        result.targetPullRequestNumber,
        result.submission,
      );
      return {
        ...result,
        submission,
        ...(submission.merge.status === 'pending'
          ? { next: submission.next }
          : {}),
      };
    },
  );

  fastify.put(
    '/repos/:owner/:repo/pulls/:pullNumber/merge-async',
    async (request, reply) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = mergePullRequestAsyncBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      const submission = unwrapResult(
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
      return sendAsyncMergeSubmission(
        reply,
        owner,
        repo,
        pullNumber,
        submission,
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
