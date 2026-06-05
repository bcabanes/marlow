import {
  addAssignees,
  addLabels,
  clearMilestone,
  closeIssue,
  createIssue,
  createIssueComment,
  getIssue,
  listIssueComments,
  listIssues,
  removeAssignees,
  removeLabel,
  setMilestone,
  updateIssue,
} from '@org/marlow-application';
import {
  addLabelsBodySchema,
  assigneesBodySchema,
  confirmBodySchema,
  createIssueBodySchema,
  createIssueCommentBodySchema,
  issueLabelParamsSchema,
  issueNumberParamsSchema,
  listIssuesQuerySchema,
  paginationQuerySchema,
  repoParamsSchema,
  setMilestoneBodySchema,
  updateIssueBodySchema,
} from '@org/marlow-api-contracts';
import { FastifyInstance } from 'fastify';
import { AppDependencies } from '../dependencies';
import { unwrapResult } from '../error-mapping';

export const registerIssuesRoutes = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.get('/repos/:owner/:repo/issues', async (request) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const { state, page, perPage } = listIssuesQuerySchema.parse(request.query);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await listIssues(port)({ owner, repo, state, page, perPage }),
    );
  });

  fastify.get('/repos/:owner/:repo/issues/:issueNumber', async (request) => {
    const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
      request.params,
    );
    const port = await deps.getGitHubPort();
    return unwrapResult(await getIssue(port)({ owner, repo, issueNumber }));
  });

  fastify.post('/repos/:owner/:repo/issues', async (request, reply) => {
    const { owner, repo } = repoParamsSchema.parse(request.params);
    const body = createIssueBodySchema.parse(request.body);
    const port = await deps.getGitHubPort();
    const issue = unwrapResult(
      await createIssue(port)({
        owner,
        repo,
        title: body.title,
        body: body.body,
        labels: body.labels,
      }),
    );
    reply.code(201);
    return issue;
  });

  fastify.post(
    '/repos/:owner/:repo/issues/:issueNumber/close',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(await closeIssue(port)({ owner, repo, issueNumber }));
    },
  );

  fastify.get(
    '/repos/:owner/:repo/issues/:issueNumber/comments',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const { page, perPage } = paginationQuerySchema.parse(request.query);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await listIssueComments(port)({
          owner,
          repo,
          issueNumber,
          page,
          perPage,
        }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/issues/:issueNumber/comments',
    async (request, reply) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const body = createIssueCommentBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      const comment = unwrapResult(
        await createIssueComment(port)({
          owner,
          repo,
          issueNumber,
          body: body.body,
        }),
      );
      reply.code(201);
      return comment;
    },
  );

  fastify.patch('/repos/:owner/:repo/issues/:issueNumber', async (request) => {
    const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
      request.params,
    );
    const body = updateIssueBodySchema.parse(request.body);
    const port = await deps.getGitHubPort();
    return unwrapResult(
      await updateIssue(port)({
        owner,
        repo,
        issueNumber,
        title: body.title,
        body: body.body,
        state: body.state,
        stateReason: body.stateReason,
      }),
    );
  });

  fastify.post(
    '/repos/:owner/:repo/issues/:issueNumber/labels',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const body = addLabelsBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await addLabels(port)({ owner, repo, issueNumber, labels: body.labels }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/issues/:issueNumber/labels/:name',
    async (request) => {
      const { owner, repo, issueNumber, name } = issueLabelParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await removeLabel(port)({ owner, repo, issueNumber, label: name }),
      );
    },
  );

  fastify.post(
    '/repos/:owner/:repo/issues/:issueNumber/assignees',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const body = assigneesBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await addAssignees(port)({
          owner,
          repo,
          issueNumber,
          assignees: body.assignees,
        }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/issues/:issueNumber/assignees',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const body = assigneesBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await removeAssignees(port)({
          owner,
          repo,
          issueNumber,
          assignees: body.assignees,
        }),
      );
    },
  );

  fastify.put(
    '/repos/:owner/:repo/issues/:issueNumber/milestone',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      const body = setMilestoneBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await setMilestone(port)({
          owner,
          repo,
          issueNumber,
          milestone: body.milestone,
        }),
      );
    },
  );

  fastify.delete(
    '/repos/:owner/:repo/issues/:issueNumber/milestone',
    async (request) => {
      const { owner, repo, issueNumber } = issueNumberParamsSchema.parse(
        request.params,
      );
      confirmBodySchema.parse(request.body);
      const port = await deps.getGitHubPort();
      return unwrapResult(
        await clearMilestone(port)({ owner, repo, issueNumber }),
      );
    },
  );
};
