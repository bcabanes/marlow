import {
  addAssignees,
  addLabels,
  clearMilestone,
  closePullRequest,
  createPullRequest,
  createPullRequestReview,
  createPullRequestReviewComment,
  createPullRequestReviewCommentReply,
  getPullRequest,
  listPullRequestComments,
  listPullRequestCommits,
  listPullRequestFiles,
  listPullRequestReviews,
  listPullRequests,
  removeAssignees,
  removeLabel,
  setMilestone,
  updatePullRequest,
} from '@org/marlow-application';
import {
  addLabelsBodySchema,
  assigneesBodySchema,
  confirmBodySchema,
  createPullRequestBodySchema,
  createPullRequestReviewBodySchema,
  createPullRequestReviewCommentBodySchema,
  createPullRequestReviewCommentReplyBodySchema,
  listPullRequestsQuerySchema,
  paginationQuerySchema,
  pullLabelParamsSchema,
  pullNumberParamsSchema,
  pullReviewCommentParamsSchema,
  repoParamsSchema,
  setMilestoneBodySchema,
  updatePullRequestBodySchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerPullsRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/pulls', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { state, page, perPage } = listPullRequestsQuerySchema.parse(
      request.query,
    );
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await listPullRequests(port)({ owner, repo, state, page, perPage }),
    );
  });

  fastify.get('/repos/:owner/:repo/pulls/:pullNumber', async (request) => {
    const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
      request.params,
    );
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await getPullRequest(port)({ owner, repo, pullNumber }),
    );
  });

  fastify.post('/repos/:owner/:repo/pulls', async (request, reply) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const body = createPullRequestBodySchema.parse(request.body);
    const port = await deps.getGitHubPort();
    const pull = unwrapResult(
      await createPullRequest(port)({
        owner,
        repo,
        title: body.title,
        head: body.head,
        base: body.base,
        body: body.body,
        draft: body.draft,
      }),
    );
    reply.code(201);
    return pull;
  });

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/close',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await closePullRequest(port)({ owner, repo, pullNumber }),
      );
    },
  );

  fastify.patch('/repos/:owner/:repo/pulls/:pullNumber', async (request) => {
    const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
      request.params,
    );
    const body = updatePullRequestBodySchema.parse(request.body);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await updatePullRequest(port)({
        owner,
        repo,
        pullNumber,
        title: body.title,
        body: body.body,
        base: body.base,
      }),
    );
  });

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/files',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const { page, perPage } = paginationQuerySchema.parse(request.query);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await listPullRequestFiles(port)({
          owner,
          repo,
          pullNumber,
          page,
          perPage,
        }),
      );
    },
  );

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/commits',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const { page, perPage } = paginationQuerySchema.parse(request.query);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await listPullRequestCommits(port)({
          owner,
          repo,
          pullNumber,
          page,
          perPage,
        }),
      );
    },
  );

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/comments',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const { page, perPage } = paginationQuerySchema.parse(request.query);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await listPullRequestComments(port)({
          owner,
          repo,
          pullNumber,
          page,
          perPage,
        }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/comments',
    async (request, reply) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = createPullRequestReviewCommentBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      const comment = unwrapResult(
        await createPullRequestReviewComment(port)(
          body.subjectType === 'file'
            ? {
                owner,
                repo,
                pullNumber,
                body: body.body,
                commitId: body.commitId,
                path: body.path,
                subjectType: 'file',
              }
            : {
                owner,
                repo,
                pullNumber,
                body: body.body,
                commitId: body.commitId,
                path: body.path,
                subjectType: body.subjectType,
                line: body.line,
                side: body.side,
                startLine: body.startLine,
                startSide: body.startSide,
              },
        ),
      );
      reply.code(201);
      return comment;
    },
  );

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/comments/:commentId/replies',
    async (request, reply) => {
      const { owner, repo, pullNumber, commentId } =
        pullReviewCommentParamsSchema.parse(request.params);
      const body = createPullRequestReviewCommentReplyBodySchema.parse(
        request.body,
      );
      const port = await deps.getGitHubPort();
      const comment = unwrapResult(
        await createPullRequestReviewCommentReply(port)({
          owner,
          repo,
          pullNumber,
          commentId,
          body: body.body,
        }),
      );
      reply.code(201);
      return comment;
    },
  );

  fastify.get(
    '/repos/:owner/:repo/pulls/:pullNumber/reviews',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const { page, perPage } = paginationQuerySchema.parse(request.query);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await listPullRequestReviews(port)({
          owner,
          repo,
          pullNumber,
          page,
          perPage,
        }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/reviews',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = createPullRequestReviewBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await createPullRequestReview(port)({
          owner,
          repo,
          pullNumber,
          // Match GitHub: omitting event creates a pending review.
          event: body.event ?? 'PENDING',
          commitId: body.commitId,
          body: body.body,
          comments: body.comments,
        }),
      );
    },
  );

  // Labels, assignees, and milestone on a pull request are managed through
  // GitHub's issues API: a PR's number is its issue number, so each handler
  // passes `pullNumber` as the use case's `issueNumber`.

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/labels',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = addLabelsBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await addLabels(port)({
          owner,
          repo,
          issueNumber: pullNumber,
          labels: body.labels,
        }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/pulls/:pullNumber/labels/:name',
    async (request) => {
      const { owner, repo, pullNumber, name } = pullLabelParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await removeLabel(port)({
          owner,
          repo,
          issueNumber: pullNumber,
          label: name,
        }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/pulls/:pullNumber/assignees',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = assigneesBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await addAssignees(port)({
          owner,
          repo,
          issueNumber: pullNumber,
          assignees: body.assignees,
        }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/pulls/:pullNumber/assignees',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = assigneesBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await removeAssignees(port)({
          owner,
          repo,
          issueNumber: pullNumber,
          assignees: body.assignees,
        }),
      );
    },
  );

  fastify.put(
    '/repos/:owner/:repo/pulls/:pullNumber/milestone',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      const body = setMilestoneBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await setMilestone(port)({
          owner,
          repo,
          issueNumber: pullNumber,
          milestone: body.milestone,
        }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/pulls/:pullNumber/milestone',
    async (request) => {
      const { owner, repo, pullNumber } = pullNumberParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await clearMilestone(port)({ owner, repo, issueNumber: pullNumber }),
      );
    },
  );
};
