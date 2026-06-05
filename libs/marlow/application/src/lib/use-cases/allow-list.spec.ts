import { DomainError, Result } from '@org/marlow-domain';
import { describe, expect, it } from 'vitest';
import {
  GitHubRepositoryPort,
  addAssignees,
  addLabels,
  checkPermissions,
  clearMilestone,
  closeIssue,
  closePullRequest,
  createIssue,
  createIssueComment,
  createPullRequest,
  getCombinedStatus,
  getCommit,
  getFileContents,
  getIssue,
  getPullRequest,
  listCheckRuns,
  listCommits,
  listIssueComments,
  listIssues,
  listPullRequestComments,
  listPullRequestCommits,
  listPullRequestFiles,
  listPullRequests,
  listTree,
  removeAssignees,
  removeLabel,
  searchCode,
  setMilestone,
  updateIssue,
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
    () =>
      setMilestone(throwingPort)({ ...repo, issueNumber: 1, milestone: 1 }),
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
