import {
  AsyncMergeResult,
  AsyncMergeSubmission,
  GitHubPortError,
  GitHubRepositoryPort,
} from '@org/marlow-application';
import { compareRangeToString } from '@org/marlow-domain';
import type { Octokit } from 'octokit';
import { RequestError } from 'octokit';
import { mapGitHubError } from './github-error-mapper.js';
import {
  mapAsyncMergeResult,
  mapAssigneeSet,
  mapCheckRuns,
  mapCodeSearch,
  mapCombinedStatus,
  mapCommitComparison,
  mapCommitDetail,
  mapCommitListItem,
  mapFileContents,
  mapIssue,
  mapIssueComment,
  mapIssueSummary,
  mapLabelSet,
  mapMilestoneResult,
  mapPageInfo,
  mapPermissionCheck,
  mapPullRequest,
  mapPullRequestFile,
  mapPullRequestReview,
  mapPullRequestStack,
  mapPullRequestStackSummary,
  mapPullRequestSummary,
  mapReviewComment,
  mapTree,
} from './github-dto-mapper.js';
import {
  parseAsyncMergeResult,
  parsePullRequestStack,
  parsePullRequestStackSummaries,
} from './github-stack.schema.js';

type PullGetData = Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data'];

const STACKS_API_HEADERS = {
  'X-GitHub-Api-Version': '2026-03-10',
} as const;

// Check runs created by GitHub Actions belong to this app. An Actions check
// run's id is its job id: GitHub's job example pairs job id 399444496 with
// check_run_url .../check-runs/399444496.
const GITHUB_ACTIONS_APP_SLUG = 'github-actions';

// REST cannot change a pull request's draft state; only GraphQL can.
const CONVERT_PULL_REQUEST_TO_DRAFT_MUTATION = `
  mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
    convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
      clientMutationId
    }
  }
`;

const MARK_PULL_REQUEST_READY_FOR_REVIEW_MUTATION = `
  mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
    markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
      clientMutationId
    }
  }
`;

const asyncMergeSubmissionFor = (
  status: number,
  merge: AsyncMergeResult,
): AsyncMergeSubmission => {
  switch (status) {
    case 202:
      if (merge.status === 'pending') {
        return { outcome: 'accepted', merge };
      }
      break;
    case 200:
      if (merge.status === 'merged' || merge.status === 'enqueued') {
        return { outcome: 'completed', merge };
      }
      break;
    case 400:
      if (merge.status === 'failed') {
        return { outcome: 'rejected', merge };
      }
      break;
    case 409:
      if (merge.status === 'pending') {
        return { outcome: 'alreadyPending', merge };
      }
      break;
  }

  throw new GitHubPortError(
    'unavailable',
    `GitHub returned asynchronous merge status ${merge.status} with HTTP ${status}`,
  );
};

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

  const callAsyncMergeSubmission = async (
    fn: () => Promise<{ readonly data: unknown; readonly status: number }>,
  ): Promise<AsyncMergeSubmission> => {
    try {
      const { data, status } = await fn();
      return asyncMergeSubmissionFor(
        status,
        mapAsyncMergeResult(parseAsyncMergeResult(data)),
      );
    } catch (error) {
      // GitHub returns useful terminal/pollable results with 400 and 409.
      // Preserve those normalized results instead of turning them into errors.
      if (
        error instanceof RequestError &&
        (error.status === 400 || error.status === 409)
      ) {
        return asyncMergeSubmissionFor(
          error.status,
          mapAsyncMergeResult(parseAsyncMergeResult(error.response?.data)),
        );
      }
      if (error instanceof GitHubPortError) throw error;
      throw mapGitHubError(error);
    }
  };

  const callAsyncMergeResult = (
    fn: () => Promise<{ readonly data: unknown }>,
  ): Promise<AsyncMergeResult> =>
    call(async () => {
      const { data } = await fn();
      return mapAsyncMergeResult(parseAsyncMergeResult(data));
    });

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
        return data.map(mapCommitListItem);
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

    compareCommits: ({ repo, range, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
          owner: repo.owner,
          repo: repo.repo,
          basehead: compareRangeToString(range),
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return mapCommitComparison(data);
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
          .map(mapIssueSummary);
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
          headers: STACKS_API_HEADERS,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapPullRequestSummary);
      }),

    getPullRequest: ({ repo, pullNumber }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.get({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          headers: STACKS_API_HEADERS,
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
          headers: STACKS_API_HEADERS,
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
          headers: STACKS_API_HEADERS,
        });
        return mapPullRequest(data);
      }),

    updatePullRequest: ({ repo, pullNumber, title, body, base, draft }) =>
      call(async () => {
        const pull = {
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          headers: STACKS_API_HEADERS,
        };

        // Converge the draft flag from the state GitHub reports, so a repeat
        // request sends no mutation. `unchanged` is the PR as read when it
        // already had the requested flag, and stays usable as the response.
        let unchanged: PullGetData | null = null;
        if (draft !== undefined) {
          const { data: current } = await octokit.rest.pulls.get(pull);
          if ((current.draft ?? false) === draft) {
            unchanged = current;
          } else {
            await octokit.graphql(
              draft
                ? CONVERT_PULL_REQUEST_TO_DRAFT_MUTATION
                : MARK_PULL_REQUEST_READY_FOR_REVIEW_MUTATION,
              { pullRequestId: current.node_id },
            );
          }
        }

        if (title === undefined && body === undefined && base === undefined) {
          if (unchanged !== null) return mapPullRequest(unchanged);
          const { data } = await octokit.rest.pulls.get(pull);
          return mapPullRequest(data);
        }

        const { data } = await octokit.rest.pulls.update({
          ...pull,
          ...(title === undefined ? {} : { title }),
          ...(body === undefined ? {} : { body }),
          ...(base === undefined ? {} : { base }),
        });
        return mapPullRequest(data);
      }),

    listPullRequestFiles: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        const { data, headers } = await octokit.rest.pulls.listFiles({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return {
          files: data.map(mapPullRequestFile),
          ...mapPageInfo({ page, perPage, link: headers.link }),
        };
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
        return data.map(mapCommitListItem);
      }),

    listPullRequestComments: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        // GitHub's pulls/{n}/comments endpoint returns review comments — the
        // inline remarks anchored to the diff — which are distinct from the
        // conversation comments served by issues/{n}/comments.
        const { data } = await octokit.rest.pulls.listReviewComments({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapReviewComment);
      }),

    createPullRequestReviewComment: ({
      repo,
      pullNumber,
      body,
      commitId,
      target,
    }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.createReviewComment({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          body,
          commit_id: commitId,
          path: target.path,
          subject_type: target.subjectType,
          ...(target.subjectType === 'file'
            ? {}
            : {
                line: target.line,
                side: target.side,
                ...(target.startLine === undefined
                  ? {}
                  : { start_line: target.startLine }),
                ...(target.startSide === undefined
                  ? {}
                  : { start_side: target.startSide }),
              }),
        });
        return mapReviewComment(data);
      }),

    createPullRequestReviewCommentReply: ({
      repo,
      pullNumber,
      commentId,
      body,
    }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.createReplyForReviewComment({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          comment_id: commentId,
          body,
        });
        return mapReviewComment(data);
      }),

    listPullRequestReviews: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.listReviews({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          ...(page === undefined ? {} : { page }),
          ...(perPage === undefined ? {} : { per_page: perPage }),
        });
        return data.map(mapPullRequestReview);
      }),

    createPullRequestReview: ({
      repo,
      pullNumber,
      event,
      commitId,
      body,
      comments,
    }) =>
      call(async () => {
        const { data } = await octokit.rest.pulls.createReview({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          // GitHub creates a pending review only when `event` is omitted.
          ...(event === 'PENDING' ? {} : { event }),
          ...(commitId === undefined ? {} : { commit_id: commitId }),
          ...(body === undefined ? {} : { body }),
          ...(comments === undefined
            ? {}
            : {
                comments: comments.map((comment) => ({
                  body: comment.body,
                  path: comment.path,
                  line: comment.line,
                  side: comment.side,
                  ...(comment.startLine === undefined
                    ? {}
                    : { start_line: comment.startLine }),
                  ...(comment.startSide === undefined
                    ? {}
                    : { start_side: comment.startSide }),
                })),
              }),
        });
        return mapPullRequestReview(data);
      }),

    listPullRequestStacks: ({ repo, pullNumber, page, perPage }) =>
      call(async () => {
        const { data } = await octokit.request(
          'GET /repos/{owner}/{repo}/stacks',
          {
            owner: repo.owner,
            repo: repo.repo,
            headers: STACKS_API_HEADERS,
            ...(pullNumber === undefined ? {} : { pull_request: pullNumber }),
            ...(page === undefined ? {} : { page }),
            ...(perPage === undefined ? {} : { per_page: perPage }),
          },
        );
        return parsePullRequestStackSummaries(data).map(
          mapPullRequestStackSummary,
        );
      }),

    getPullRequestStack: ({ repo, stackNumber }) =>
      call(async () => {
        const { data } = await octokit.request(
          'GET /repos/{owner}/{repo}/stacks/{stack_number}',
          {
            owner: repo.owner,
            repo: repo.repo,
            stack_number: stackNumber,
            headers: STACKS_API_HEADERS,
          },
        );
        return mapPullRequestStack(parsePullRequestStack(data));
      }),

    createPullRequestStack: ({ repo, pullNumbers }) =>
      call(async () => {
        const { data } = await octokit.request(
          'POST /repos/{owner}/{repo}/stacks',
          {
            owner: repo.owner,
            repo: repo.repo,
            pull_requests: [...pullNumbers],
            headers: STACKS_API_HEADERS,
          },
        );
        return mapPullRequestStack(parsePullRequestStack(data));
      }),

    addPullRequestsToStack: ({ repo, stackNumber, pullNumbers }) =>
      call(async () => {
        const { data } = await octokit.request(
          'POST /repos/{owner}/{repo}/stacks/{stack_number}/add',
          {
            owner: repo.owner,
            repo: repo.repo,
            stack_number: stackNumber,
            pull_requests: [...pullNumbers],
            headers: STACKS_API_HEADERS,
          },
        );
        return mapPullRequestStack(parsePullRequestStack(data));
      }),

    unstackPullRequests: ({ repo, stackNumber }) =>
      call(async () => {
        const { data } = await octokit.request(
          'POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack',
          {
            owner: repo.owner,
            repo: repo.repo,
            stack_number: stackNumber,
            headers: STACKS_API_HEADERS,
          },
        );
        return data === undefined || data === null || data === ''
          ? { outcome: 'dissolved' as const }
          : {
              outcome: 'updated' as const,
              stack: mapPullRequestStack(parsePullRequestStack(data)),
            };
      }),

    mergePullRequestAsync: ({
      repo,
      pullNumber,
      mergeMethod,
      mergeAction,
      commitTitle,
      commitMessage,
      expectedHeadSha,
    }) =>
      callAsyncMergeSubmission(() =>
        octokit.request(
          'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async',
          {
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pullNumber,
            headers: STACKS_API_HEADERS,
            ...(mergeMethod === undefined ? {} : { merge_method: mergeMethod }),
            ...(mergeAction === undefined ? {} : { merge_action: mergeAction }),
            ...(commitTitle === undefined ? {} : { commit_title: commitTitle }),
            ...(commitMessage === undefined
              ? {}
              : { commit_message: commitMessage }),
            ...(expectedHeadSha === undefined ? {} : { sha: expectedHeadSha }),
          },
        ),
      ),

    getPullRequestMergeResult: ({ repo, pullNumber, mergeId }) =>
      callAsyncMergeResult(() =>
        octokit.request(
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}',
          {
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pullNumber,
            uuid: mergeId,
            headers: STACKS_API_HEADERS,
          },
        ),
      ),

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

    rerunCheckRun: ({ repo, checkRunId }) =>
      call(async () => {
        const { data: run } = await octokit.rest.checks.get({
          owner: repo.owner,
          repo: repo.repo,
          check_run_id: checkRunId,
        });
        const app = run.app?.slug ?? null;
        // GitHub's rerequest docs send Actions runs to the job re-run endpoint.
        if (app === GITHUB_ACTIONS_APP_SLUG) {
          await octokit.rest.actions.reRunJobForWorkflowRun({
            owner: repo.owner,
            repo: repo.repo,
            job_id: run.id,
          });
          return {
            via: 'actions_job_rerun' as const,
            checkRunId: run.id,
            jobId: run.id,
          };
        }
        await octokit.rest.checks.rerequestRun({
          owner: repo.owner,
          repo: repo.repo,
          check_run_id: run.id,
        });
        return { via: 'check_run_rerequest' as const, checkRunId: run.id, app };
      }),
  };
};
