import { DomainError, Result } from '@org/marlow-domain';
import { describe, expect, it } from 'vitest';
import {
  GitHubRepositoryPort,
  addPullRequestsToStack,
  addAssignees,
  addLabels,
  checkPermissions,
  clearMilestone,
  closeIssue,
  closePullRequest,
  createIssue,
  createIssueComment,
  createPullRequest,
  createPullRequestStack,
  getCombinedStatus,
  getCommit,
  getFileContents,
  getIssue,
  getPullRequest,
  getPullRequestMergeResult,
  getPullRequestStack,
  listCheckRuns,
  listCommits,
  listIssueComments,
  listIssues,
  listPullRequestComments,
  listPullRequestCommits,
  listPullRequestFiles,
  listPullRequestReviews,
  listPullRequestStacks,
  listPullRequests,
  listTree,
  mergePullRequestAsync,
  mergePullRequestStack,
  removeAssignees,
  removeLabel,
  searchCode,
  setMilestone,
  updateIssue,
  unstackPullRequests,
} from '../../index.js';

// A port whose every method throws if invoked. A use case that rejects a repo
// before calling GitHub will never trigger it, proving the allow-list is the
// gate and credentials/GitHub are never reached for a disallowed repo.
const throwingPort = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error('GitHub port must not be called for a disallowed repo');
      };
    },
  },
) as unknown as GitHubRepositoryPort;

const repo = { owner: 'evil', repo: 'not-allowed' };

type Invoke = () => Promise<Result<unknown, DomainError>>;

const invocations: ReadonlyArray<readonly [string, Invoke]> = [
  ['checkPermissions', () => checkPermissions(throwingPort)({ ...repo })],
  ['listTree', () => listTree(throwingPort)({ ...repo, ref: 'main' })],
  [
    'getFileContents',
    () => getFileContents(throwingPort)({ ...repo, path: 'a.ts' }),
  ],
  ['searchCode', () => searchCode(throwingPort)({ ...repo, query: 'x' })],
  ['listCommits', () => listCommits(throwingPort)({ ...repo })],
  ['getCommit', () => getCommit(throwingPort)({ ...repo, sha: 'abc1234' })],
  ['listIssues', () => listIssues(throwingPort)({ ...repo })],
  ['getIssue', () => getIssue(throwingPort)({ ...repo, issueNumber: 1 })],
  ['createIssue', () => createIssue(throwingPort)({ ...repo, title: 'x' })],
  ['closeIssue', () => closeIssue(throwingPort)({ ...repo, issueNumber: 1 })],
  [
    'updateIssue',
    () => updateIssue(throwingPort)({ ...repo, issueNumber: 1, title: 'x' }),
  ],
  [
    'addLabels',
    () => addLabels(throwingPort)({ ...repo, issueNumber: 1, labels: ['bug'] }),
  ],
  [
    'removeLabel',
    () => removeLabel(throwingPort)({ ...repo, issueNumber: 1, label: 'bug' }),
  ],
  [
    'addAssignees',
    () =>
      addAssignees(throwingPort)({
        ...repo,
        issueNumber: 1,
        assignees: ['octocat'],
      }),
  ],
  [
    'removeAssignees',
    () =>
      removeAssignees(throwingPort)({
        ...repo,
        issueNumber: 1,
        assignees: ['octocat'],
      }),
  ],
  [
    'setMilestone',
    () => setMilestone(throwingPort)({ ...repo, issueNumber: 1, milestone: 1 }),
  ],
  [
    'clearMilestone',
    () => clearMilestone(throwingPort)({ ...repo, issueNumber: 1 }),
  ],
  [
    'listIssueComments',
    () => listIssueComments(throwingPort)({ ...repo, issueNumber: 1 }),
  ],
  [
    'createIssueComment',
    () =>
      createIssueComment(throwingPort)({ ...repo, issueNumber: 1, body: 'x' }),
  ],
  ['listPullRequests', () => listPullRequests(throwingPort)({ ...repo })],
  [
    'getPullRequest',
    () => getPullRequest(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'createPullRequest',
    () =>
      createPullRequest(throwingPort)({
        ...repo,
        title: 'x',
        head: 'feature',
        base: 'main',
      }),
  ],
  [
    'closePullRequest',
    () => closePullRequest(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'listPullRequestFiles',
    () => listPullRequestFiles(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'listPullRequestCommits',
    () => listPullRequestCommits(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'listPullRequestComments',
    () => listPullRequestComments(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'listPullRequestReviews',
    () => listPullRequestReviews(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'listPullRequestStacks',
    () => listPullRequestStacks(throwingPort)({ ...repo }),
  ],
  [
    'getPullRequestStack',
    () => getPullRequestStack(throwingPort)({ ...repo, stackNumber: 1 }),
  ],
  [
    'createPullRequestStack',
    () =>
      createPullRequestStack(throwingPort)({
        ...repo,
        pullNumbers: [1, 2],
      }),
  ],
  [
    'addPullRequestsToStack',
    () =>
      addPullRequestsToStack(throwingPort)({
        ...repo,
        stackNumber: 1,
        pullNumbers: [2],
      }),
  ],
  [
    'unstackPullRequests',
    () => unstackPullRequests(throwingPort)({ ...repo, stackNumber: 1 }),
  ],
  [
    'mergePullRequestAsync',
    () => mergePullRequestAsync(throwingPort)({ ...repo, pullNumber: 1 }),
  ],
  [
    'mergePullRequestStack',
    () => mergePullRequestStack(throwingPort)({ ...repo, stackNumber: 1 }),
  ],
  [
    'getPullRequestMergeResult',
    () =>
      getPullRequestMergeResult(throwingPort)({
        ...repo,
        pullNumber: 1,
        mergeId: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
      }),
  ],
  [
    'getCombinedStatus',
    () => getCombinedStatus(throwingPort)({ ...repo, ref: 'main' }),
  ],
  [
    'listCheckRuns',
    () => listCheckRuns(throwingPort)({ ...repo, ref: 'main' }),
  ],
];

describe('allow-list enforcement (every repo-scoped use case)', () => {
  it.each(invocations)(
    '%s rejects a disallowed repo before touching GitHub',
    async (_name, invoke) => {
      const result = await invoke();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('repo_not_allowed');
    },
  );
});

describe('searchCode rejects scope-qualifier injection on an allowed repo', () => {
  it('returns invalid_search_query without touching GitHub', async () => {
    const result = await searchCode(throwingPort)({
      owner: 'nrwl',
      repo: 'nx',
      query: 'token org:stripe',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_search_query');
  });
});
