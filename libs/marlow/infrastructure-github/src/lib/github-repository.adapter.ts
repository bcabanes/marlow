import { GitHubPortError, GitHubRepositoryPort } from '@org/marlow-application';
import type { Octokit } from 'octokit';
import { mapGitHubError } from './github-error-mapper.js';
import {
  mapAssigneeSet,
  mapCheckRuns,
  mapCodeSearch,
  mapCombinedStatus,
  mapCommitDetail,
  mapCommitSummary,
  mapFileContents,
  mapIssue,
  mapIssueComment,
  mapLabelSet,
  mapMilestoneResult,
  mapPermissionCheck,
  mapPullRequest,
  mapPullRequestFile,
  mapTree,
} from './github-dto-mapper.js';

/**
 * Octokit-backed implementation of {@link GitHubRepositoryPort}.
 *
 * Every call is funneled through `call`, which converts any thrown provider
 * error into a {@link GitHubPortError}. Responses are mapped to internal DTOs;
 * raw GitHub payloads never leave this module.
 */
export const createGitHubRepositoryAdapter = (
  octokit: Octokit,
): GitHubRepositoryPort => {
  const call = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      throw mapGitHubError(error);
    }
  };

  return {
    checkPermissions: (repo) =>
      call(async () => {
        const { data } = await octokit.rest.repos.get({
          owner: repo.owner,
          repo: repo.repo,
        });
        return mapPermissionCheck(data);
      }),

    listTree: ({ repo, ref, recursive }) =>
      call(async () => {
        const commit = await octokit.rest.repos.getCommit({
          owner: repo.owner,
          repo: repo.repo,
          ref,
        });
        const tree = await octokit.rest.git.getTree({
          owner: repo.owner,
          repo: repo.repo,
          tree_sha: commit.data.commit.tree.sha,
          ...(recursive ? { recursive: 'true' } : {}),
        });
        return mapTree(tree.data);
      }),

    getFileContents: ({ repo, path, ref }) =>
      call(async () => {
        const { data } = await octokit.rest.repos.getContent({
          owner: repo.owner,
          repo: repo.repo,
          path,
          ...(ref === undefined ? {} : { ref }),
        });
        if (Array.isArray(data) || data.type !== 'file') {
          throw new GitHubPortError(
            'unprocessable',
            'Requested path is not a file',
          );
        }
        if (data.encoding !== 'base64') {
          // GitHub omits content (encoding 'none') for files larger than 1 MB;
          // decoding that as base64 would silently yield empty content.
          throw new GitHubPortError(
            'unprocessable',
            'File is too large to fetch via the contents API',
          );
        }
        return mapFileContents(data);
      }),

    searchCode: ({ repo, query, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.search.code({
          q: `${query} repo:${repo.owner}/${repo.repo}`,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return mapCodeSearch(data);
      }),

    listCommits: ({ repo, ref, path, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.repos.listCommits({
          owner: repo.owner,
          repo: repo.repo,
          ...(ref === undefined ? {} : { sha: ref }),
          ...(path === undefined ? {} : { path }),
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapCommitSummary);
      }),

    getCommit: ({ repo, sha }) =>
      call(async () => {
        const { data } = await octokit.rest.repos.getCommit({
          owner: repo.owner,
          repo: repo.repo,
          ref: sha,
        });
        return mapCommitDetail(data);
      }),

    listIssues: ({ repo, state, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.listForRepo({
          owner: repo.owner,
          repo: repo.repo,
          state,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        // listForRepo also returns pull requests; exclude them.
        return data
          .filter((issue) => issue.pull_request === undefined)
          .map(mapIssue);
      }),

    getIssue: ({ repo, issueNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.get({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
        });
        return mapIssue(data);
      }),

    createIssue: ({ repo, title, body, labels }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.create({
          owner: repo.owner,
          repo: repo.repo,
          title,
          ...(body === undefined ? {} : { body }),
          ...(labels === undefined ? {} : { labels: [...labels] }),
        });
        return mapIssue(data);
      }),

    closeIssue: ({ repo, issueNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.update({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          state: 'closed',
        });
        return mapIssue(data);
      }),

    updateIssue: ({ repo, issueNumber, title, body, state, stateReason }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.update({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          ...(title === undefined ? {} : { title }),
          ...(body === undefined ? {} : { body }),
          ...(state === undefined ? {} : { state }),
          ...(stateReason === undefined ? {} : { state_reason: stateReason }),
        });
        return mapIssue(data);
      }),

    listIssueComments: ({ repo, issueNumber, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.listComments({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapIssueComment);
      }),

    createIssueComment: ({ repo, issueNumber, body }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.createComment({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          body,
        });
        return mapIssueComment(data);
      }),

    listPullRequests: ({ repo, state, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.list({
          owner: repo.owner,
          repo: repo.repo,
          state,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapPullRequest);
      }),

    getPullRequest: ({ repo, pullNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.get({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
        });
        return mapPullRequest(data);
      }),

    createPullRequest: ({ repo, title, head, base, body, draft }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.create({
          owner: repo.owner,
          repo: repo.repo,
          title,
          head,
          base,
          ...(body === undefined ? {} : { body }),
          ...(draft === undefined ? {} : { draft }),
        });
        return mapPullRequest(data);
      }),

    closePullRequest: ({ repo, pullNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.update({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          state: 'closed',
        });
        return mapPullRequest(data);
      }),

    updatePullRequest: ({ repo, pullNumber, title, body, base }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.update({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(title === undefined ? {} : { title }),
          ...(body === undefined ? {} : { body }),
          ...(base === undefined ? {} : { base }),
        });
        return mapPullRequest(data);
      }),

    listPullRequestFiles: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.listFiles({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapPullRequestFile);
      }),

    listPullRequestCommits: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.listCommits({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapCommitSummary);
      }),

    listPullRequestComments: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        // The conversational comments on a PR are issue comments on its number.
        const { data } = await octokit.rest.issues.listComments({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapIssueComment);
      }),

    addLabels: ({ repo, issueNumber, labels }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.addLabels({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          labels: [...labels],
        });
        return mapLabelSet(data);
      }),

    removeLabel: ({ repo, issueNumber, label }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.removeLabel({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          name: label,
        });
        return mapLabelSet(data);
      }),

    addAssignees: ({ repo, issueNumber, assignees }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.addAssignees({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          assignees: [...assignees],
        });
        return mapAssigneeSet(data);
      }),

    removeAssignees: ({ repo, issueNumber, assignees }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.removeAssignees({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          assignees: [...assignees],
        });
        return mapAssigneeSet(data);
      }),

    setMilestone: ({ repo, issueNumber, milestone }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.update({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          milestone,
        });
        return mapMilestoneResult(data);
      }),

    clearMilestone: ({ repo, issueNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.issues.update({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: issueNumber,
          milestone: null,
        });
        return mapMilestoneResult(data);
      }),

    getCombinedStatus: ({ repo, ref }) =>
      call(async () => {
        const { data } = await octokit.rest.repos.getCombinedStatusForRef({
          owner: repo.owner,
          repo: repo.repo,
          ref,
        });
        return mapCombinedStatus(data);
      }),

    listCheckRuns: ({ repo, ref }) =>
      call(async () => {
        const { data } = await octokit.rest.checks.listForRef({
          owner: repo.owner,
          repo: repo.repo,
          ref,
          per_page: 100,
        });
        return mapCheckRuns(data);
      }),
  };
};
