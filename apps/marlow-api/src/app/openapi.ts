import { API_ERROR_CODES } from '@org/marlow-api-errors';

/**
 * OpenAPI 3.1 description of the Marlow HTTP API.
 *
 * The schema fragments below mirror the Zod request contracts in
 * `@org/marlow-api-contracts`. They are hand-authored: zod@4.4.3 ships no native
 * JSON Schema export, so there is no build-time conversion. `openapi.spec.ts`
 * asserts that the documented routes stay in lock-step with the routes the app
 * actually registers, which is the part most prone to drift.
 *
 * OpenAPI 3.1 is aligned with JSON Schema 2020-12, so these fragments are valid
 * as-is. Response bodies are deliberately open schemas: the response DTOs are
 * TypeScript interfaces (not Zod), so there is no single source of truth to
 * derive them from yet — each response carries the DTO name in its description.
 */

type ParamLocation = 'path' | 'query';

interface Parameter {
  readonly name: string;
  readonly in: ParamLocation;
  readonly required: boolean;
  readonly schema: unknown;
  readonly description?: string;
}

const param = (
  name: string,
  location: ParamLocation,
  required: boolean,
  schema: unknown,
  description?: string,
): Parameter => ({
  name,
  in: location,
  required,
  schema,
  ...(description ? { description } : {}),
});

// --- reusable schema fragments (mirror api-contracts) ---
const nonEmptyString = { type: 'string', minLength: 1 };
const positiveInt = { type: 'integer', minimum: 1 };
const perPageInt = { type: 'integer', minimum: 1, maximum: 100 };
const stateSchema = { type: 'string', enum: ['open', 'closed', 'all'] };

// --- path parameter groups ---
const repoParams = [
  param('owner', 'path', true, nonEmptyString),
  param('repo', 'path', true, nonEmptyString),
];
const issueParams = [
  ...repoParams,
  param('issueNumber', 'path', true, positiveInt),
];
const pullParams = [...repoParams, param('pullNumber', 'path', true, positiveInt)];
const commitParams = [...repoParams, param('sha', 'path', true, nonEmptyString)];
const contentsParams = [
  ...repoParams,
  param(
    'path',
    'path',
    true,
    nonEmptyString,
    'File path within the repository; may contain slashes.',
  ),
];
const labelNameParam = param(
  'name',
  'path',
  true,
  nonEmptyString,
  'Label name; URL-encode names that contain spaces.',
);
const issueLabelParams = [...issueParams, labelNameParam];
const pullLabelParams = [...pullParams, labelNameParam];

// --- query parameter groups ---
const pagination = [
  param('page', 'query', false, positiveInt),
  param('perPage', 'query', false, perPageInt),
];
const stateQuery = param('state', 'query', false, stateSchema);
const treeQuery = [
  param('ref', 'query', true, nonEmptyString, 'Branch, tag, or commit SHA.'),
  param(
    'recursive',
    'query',
    false,
    { type: 'string', enum: ['true', 'false'] },
    'Recurse the full tree when "true".',
  ),
];
const fileQuery = [
  param('ref', 'query', false, nonEmptyString, 'Branch, tag, or commit SHA.'),
];
const searchQuery = [
  param(
    'query',
    'query',
    true,
    nonEmptyString,
    'Code search terms. repo:/org:/user:/fork: qualifiers are rejected.',
  ),
  ...pagination,
];
const commitsQuery = [
  param('ref', 'query', false, nonEmptyString),
  param('path', 'query', false, nonEmptyString),
  ...pagination,
];
const refQuery = [
  param('ref', 'query', true, nonEmptyString, 'Branch, tag, or commit SHA.'),
];

// --- request body schemas (mirror api-contracts) ---
const confirmBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm'],
  properties: { confirm: { const: true } },
};
const createIssueBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'title'],
  properties: {
    confirm: { const: true },
    title: { type: 'string', minLength: 1, maxLength: 256 },
    body: { type: 'string', maxLength: 65536 },
    labels: { type: 'array', items: nonEmptyString, maxItems: 20 },
  },
};
const createIssueCommentBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'body'],
  properties: {
    confirm: { const: true },
    body: { type: 'string', minLength: 1, maxLength: 65536 },
  },
};
const createPullBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'title', 'head', 'base'],
  properties: {
    confirm: { const: true },
    title: { type: 'string', minLength: 1, maxLength: 256 },
    head: nonEmptyString,
    base: nonEmptyString,
    body: { type: 'string', maxLength: 65536 },
    draft: { type: 'boolean' },
  },
};
const updatePullBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm'],
  description: 'Provide at least one of title, body, or base.',
  properties: {
    confirm: { const: true },
    title: { type: 'string', minLength: 1, maxLength: 256 },
    body: { type: 'string', maxLength: 65536 },
    base: nonEmptyString,
  },
};
const updateIssueBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm'],
  description: 'Provide at least one of title, body, state, or stateReason.',
  properties: {
    confirm: { const: true },
    title: { type: 'string', minLength: 1, maxLength: 256 },
    body: { type: 'string', maxLength: 65536 },
    state: { type: 'string', enum: ['open', 'closed'] },
    stateReason: {
      type: 'string',
      enum: ['completed', 'not_planned', 'reopened'],
    },
  },
};
const addLabelsBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'labels'],
  properties: {
    confirm: { const: true },
    labels: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 50 },
      minItems: 1,
      maxItems: 20,
    },
  },
};
const assigneesBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'assignees'],
  properties: {
    confirm: { const: true },
    assignees: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 39 },
      minItems: 1,
      maxItems: 10,
    },
  },
};
const setMilestoneBody = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm', 'milestone'],
  properties: {
    confirm: { const: true },
    milestone: { type: 'integer', minimum: 1 },
  },
};

interface Endpoint {
  readonly method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  readonly path: string;
  readonly tag: string;
  readonly operationId: string;
  readonly summary: string;
  readonly returns: string;
  readonly params?: readonly Parameter[];
  readonly body?: unknown;
  readonly status?: 200 | 201;
  readonly write?: boolean;
}

const endpoints: readonly Endpoint[] = [
  { method: 'get', path: '/openapi.json', tag: 'meta', operationId: 'getOpenApiDocument', summary: 'This OpenAPI 3.1 document', returns: 'OpenAPI 3.1 document' },
  { method: 'get', path: '/health', tag: 'meta', operationId: 'healthCheck', summary: 'Liveness check', returns: '{ "status": "ok" }' },
  { method: 'get', path: '/repos', tag: 'repositories', operationId: 'listRepositories', summary: 'List the allow-listed repositories', returns: 'Repository[]' },
  { method: 'get', path: '/repos/{owner}/{repo}/permissions', tag: 'repositories', operationId: 'checkPermissions', summary: "Token's permission level on the repo", returns: 'PermissionCheck', params: repoParams },
  { method: 'get', path: '/repos/{owner}/{repo}/tree', tag: 'contents', operationId: 'listTree', summary: 'List the git tree at a ref', returns: 'TreeResult', params: [...repoParams, ...treeQuery] },
  { method: 'get', path: '/repos/{owner}/{repo}/contents/{path}', tag: 'contents', operationId: 'getFileContents', summary: 'Read a file', returns: 'FileContents', params: [...contentsParams, ...fileQuery] },
  { method: 'get', path: '/repos/{owner}/{repo}/search/code', tag: 'contents', operationId: 'searchCode', summary: 'Search code within the repo', returns: 'CodeSearchResult', params: [...repoParams, ...searchQuery] },
  { method: 'get', path: '/repos/{owner}/{repo}/commits', tag: 'commits', operationId: 'listCommits', summary: 'List commits', returns: 'CommitSummary[]', params: [...repoParams, ...commitsQuery] },
  { method: 'get', path: '/repos/{owner}/{repo}/commits/{sha}', tag: 'commits', operationId: 'getCommit', summary: 'Get a commit with stats and files', returns: 'CommitDetail', params: commitParams },
  { method: 'get', path: '/repos/{owner}/{repo}/issues', tag: 'issues', operationId: 'listIssues', summary: 'List issues', returns: 'Issue[]', params: [...repoParams, stateQuery, ...pagination] },
  { method: 'get', path: '/repos/{owner}/{repo}/issues/{issueNumber}', tag: 'issues', operationId: 'getIssue', summary: 'Get an issue', returns: 'Issue', params: issueParams },
  { method: 'post', path: '/repos/{owner}/{repo}/issues', tag: 'issues', operationId: 'createIssue', summary: 'Create an issue', returns: 'Issue', params: repoParams, body: createIssueBody, status: 201, write: true },
  { method: 'post', path: '/repos/{owner}/{repo}/issues/{issueNumber}/close', tag: 'issues', operationId: 'closeIssue', summary: 'Close an issue', returns: 'Issue', params: issueParams, body: confirmBody, write: true },
  { method: 'get', path: '/repos/{owner}/{repo}/issues/{issueNumber}/comments', tag: 'issues', operationId: 'listIssueComments', summary: 'List issue comments', returns: 'IssueComment[]', params: [...issueParams, ...pagination] },
  { method: 'post', path: '/repos/{owner}/{repo}/issues/{issueNumber}/comments', tag: 'issues', operationId: 'createIssueComment', summary: 'Comment on an issue', returns: 'IssueComment', params: issueParams, body: createIssueCommentBody, status: 201, write: true },
  { method: 'patch', path: '/repos/{owner}/{repo}/issues/{issueNumber}', tag: 'issues', operationId: 'updateIssue', summary: 'Edit an issue (title, body, state, stateReason)', returns: 'Issue', params: issueParams, body: updateIssueBody, write: true },
  { method: 'post', path: '/repos/{owner}/{repo}/issues/{issueNumber}/labels', tag: 'issues', operationId: 'addIssueLabels', summary: 'Add labels to an issue', returns: 'LabelSet', params: issueParams, body: addLabelsBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/issues/{issueNumber}/labels/{name}', tag: 'issues', operationId: 'removeIssueLabel', summary: 'Remove a label from an issue', returns: 'LabelSet', params: issueLabelParams, body: confirmBody, write: true },
  { method: 'post', path: '/repos/{owner}/{repo}/issues/{issueNumber}/assignees', tag: 'issues', operationId: 'addIssueAssignees', summary: 'Add assignees to an issue', returns: 'AssigneeSet', params: issueParams, body: assigneesBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/issues/{issueNumber}/assignees', tag: 'issues', operationId: 'removeIssueAssignees', summary: 'Remove assignees from an issue', returns: 'AssigneeSet', params: issueParams, body: assigneesBody, write: true },
  { method: 'put', path: '/repos/{owner}/{repo}/issues/{issueNumber}/milestone', tag: 'issues', operationId: 'setIssueMilestone', summary: 'Set an issue milestone', returns: 'MilestoneResult', params: issueParams, body: setMilestoneBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/issues/{issueNumber}/milestone', tag: 'issues', operationId: 'clearIssueMilestone', summary: 'Clear an issue milestone', returns: 'MilestoneResult', params: issueParams, body: confirmBody, write: true },
  { method: 'get', path: '/repos/{owner}/{repo}/pulls', tag: 'pulls', operationId: 'listPullRequests', summary: 'List pull requests', returns: 'PullRequest[]', params: [...repoParams, stateQuery, ...pagination] },
  { method: 'get', path: '/repos/{owner}/{repo}/pulls/{pullNumber}', tag: 'pulls', operationId: 'getPullRequest', summary: 'Get a pull request', returns: 'PullRequest', params: pullParams },
  { method: 'post', path: '/repos/{owner}/{repo}/pulls', tag: 'pulls', operationId: 'createPullRequest', summary: 'Open a pull request', returns: 'PullRequest', params: repoParams, body: createPullBody, status: 201, write: true },
  { method: 'post', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/close', tag: 'pulls', operationId: 'closePullRequest', summary: 'Close a pull request', returns: 'PullRequest', params: pullParams, body: confirmBody, write: true },
  { method: 'patch', path: '/repos/{owner}/{repo}/pulls/{pullNumber}', tag: 'pulls', operationId: 'updatePullRequest', summary: 'Update a pull request (title, body, base)', returns: 'PullRequest', params: pullParams, body: updatePullBody, write: true },
  { method: 'get', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/files', tag: 'pulls', operationId: 'listPullRequestFiles', summary: 'List the files changed in a pull request', returns: 'PullRequestFile[]', params: [...pullParams, ...pagination] },
  { method: 'get', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/commits', tag: 'pulls', operationId: 'listPullRequestCommits', summary: 'List the commits in a pull request', returns: 'CommitSummary[]', params: [...pullParams, ...pagination] },
  { method: 'get', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/comments', tag: 'pulls', operationId: 'listPullRequestComments', summary: 'List the conversation comments on a pull request', returns: 'IssueComment[]', params: [...pullParams, ...pagination] },
  { method: 'post', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/labels', tag: 'pulls', operationId: 'addPullRequestLabels', summary: 'Add labels to a pull request', returns: 'LabelSet', params: pullParams, body: addLabelsBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/labels/{name}', tag: 'pulls', operationId: 'removePullRequestLabel', summary: 'Remove a label from a pull request', returns: 'LabelSet', params: pullLabelParams, body: confirmBody, write: true },
  { method: 'post', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/assignees', tag: 'pulls', operationId: 'addPullRequestAssignees', summary: 'Add assignees to a pull request', returns: 'AssigneeSet', params: pullParams, body: assigneesBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/assignees', tag: 'pulls', operationId: 'removePullRequestAssignees', summary: 'Remove assignees from a pull request', returns: 'AssigneeSet', params: pullParams, body: assigneesBody, write: true },
  { method: 'put', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/milestone', tag: 'pulls', operationId: 'setPullRequestMilestone', summary: 'Set a pull request milestone', returns: 'MilestoneResult', params: pullParams, body: setMilestoneBody, write: true },
  { method: 'delete', path: '/repos/{owner}/{repo}/pulls/{pullNumber}/milestone', tag: 'pulls', operationId: 'clearPullRequestMilestone', summary: 'Clear a pull request milestone', returns: 'MilestoneResult', params: pullParams, body: confirmBody, write: true },
  { method: 'get', path: '/repos/{owner}/{repo}/commit-status', tag: 'statuses', operationId: 'getCombinedStatus', summary: 'Combined commit status for a ref', returns: 'CombinedStatus', params: [...repoParams, ...refQuery] },
  { method: 'get', path: '/repos/{owner}/{repo}/check-runs', tag: 'checks', operationId: 'listCheckRuns', summary: 'Check runs for a ref', returns: 'CheckRun[]', params: [...repoParams, ...refQuery] },
];

const operation = (endpoint: Endpoint): Record<string, unknown> => ({
  tags: [endpoint.tag],
  operationId: endpoint.operationId,
  summary: endpoint.summary,
  ...(endpoint.write
    ? { description: 'Write endpoint — requires `{ "confirm": true }` in the body.' }
    : {}),
  ...(endpoint.params && endpoint.params.length
    ? { parameters: endpoint.params }
    : {}),
  ...(endpoint.body
    ? {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: endpoint.body } },
        },
      }
    : {}),
  responses: {
    [String(endpoint.status ?? 200)]: {
      description: endpoint.returns,
      content: { 'application/json': { schema: {} } },
    },
    default: { $ref: '#/components/responses/Error' },
  },
});

/** Build the OpenAPI 3.1 document describing every Marlow route. */
export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    (paths[endpoint.path] ??= {})[endpoint.method] = operation(endpoint);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Marlow',
      version: '0.0.1',
      description:
        'Local GitHub API broker — least-privilege access to an allow-listed set of private repositories. Repository routes only succeed for allow-listed repositories; write endpoints require `{ "confirm": true }`; every error shares the Error shape.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'meta' },
      { name: 'repositories' },
      { name: 'contents' },
      { name: 'commits' },
      { name: 'issues' },
      { name: 'pulls' },
      { name: 'statuses' },
      { name: 'checks' },
    ],
    paths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          additionalProperties: false,
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: Object.values(API_ERROR_CODES) },
                message: { type: 'string' },
                details: {},
              },
            },
          },
        },
      },
      responses: {
        Error: {
          description: 'Error response',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
      },
    },
  };
};
