import { GitHubRepositoryPort } from '@org/marlow-application';

type GitHubPortResolver = () => Promise<GitHubRepositoryPort>;

/**
 * Wraps a resolver so the underlying client (and therefore the credential
 * lookup) is only triggered when a port method is actually invoked.
 *
 * Use cases enforce the allow-list before calling any port method, so a
 * disallowed repository is rejected without ever fetching the token or
 * contacting GitHub.
 */
export const createLazyGitHubPort = (
  resolve: GitHubPortResolver,
): GitHubRepositoryPort => ({
  checkPermissions: (repo) => resolve().then((p) => p.checkPermissions(repo)),
  listTree: (input) => resolve().then((p) => p.listTree(input)),
  getFileContents: (input) => resolve().then((p) => p.getFileContents(input)),
  searchCode: (input) => resolve().then((p) => p.searchCode(input)),
  listCommits: (input) => resolve().then((p) => p.listCommits(input)),
  getCommit: (input) => resolve().then((p) => p.getCommit(input)),
  listIssues: (input) => resolve().then((p) => p.listIssues(input)),
  getIssue: (input) => resolve().then((p) => p.getIssue(input)),
  createIssue: (input) => resolve().then((p) => p.createIssue(input)),
  closeIssue: (input) => resolve().then((p) => p.closeIssue(input)),
  updateIssue: (input) => resolve().then((p) => p.updateIssue(input)),
  listIssueComments: (input) =>
    resolve().then((p) => p.listIssueComments(input)),
  createIssueComment: (input) =>
    resolve().then((p) => p.createIssueComment(input)),
  addLabels: (input) => resolve().then((p) => p.addLabels(input)),
  removeLabel: (input) => resolve().then((p) => p.removeLabel(input)),
  addAssignees: (input) => resolve().then((p) => p.addAssignees(input)),
  removeAssignees: (input) => resolve().then((p) => p.removeAssignees(input)),
  setMilestone: (input) => resolve().then((p) => p.setMilestone(input)),
  clearMilestone: (input) => resolve().then((p) => p.clearMilestone(input)),
  listPullRequests: (input) => resolve().then((p) => p.listPullRequests(input)),
  getPullRequest: (input) => resolve().then((p) => p.getPullRequest(input)),
  createPullRequest: (input) =>
    resolve().then((p) => p.createPullRequest(input)),
  closePullRequest: (input) => resolve().then((p) => p.closePullRequest(input)),
  updatePullRequest: (input) =>
    resolve().then((p) => p.updatePullRequest(input)),
  listPullRequestFiles: (input) =>
    resolve().then((p) => p.listPullRequestFiles(input)),
  listPullRequestCommits: (input) =>
    resolve().then((p) => p.listPullRequestCommits(input)),
  listPullRequestComments: (input) =>
    resolve().then((p) => p.listPullRequestComments(input)),
  getCombinedStatus: (input) =>
    resolve().then((p) => p.getCombinedStatus(input)),
  listCheckRuns: (input) => resolve().then((p) => p.listCheckRuns(input)),
});
