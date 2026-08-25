import {
  AsyncMergeId,
  FilePath,
  GitRef,
  GitSha,
  IssueNumber,
  NewPullRequestStackMembers,
  PullRequestNumber,
  PullRequestStackAdditions,
  PullRequestStackNumber,
  RepoRef,
  ReviewCommentId,
} from '@org/marlow-domain';
import {
  AsyncMergeResult,
  AsyncMergeSubmission,
  AssigneeSet,
  CheckRun,
  CodeSearchResult,
  CombinedStatus,
  CommitDetail,
  CommitListItem,
  FileContents,
  Issue,
  IssueComment,
  IssueState,
  IssueStateReason,
  IssueSummary,
  LabelSet,
  MilestoneResult,
  Pagination,
  PermissionCheck,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  PullRequestState,
  PullRequestMergeAction,
  PullRequestMergeMethod,
  PullRequestStack,
  PullRequestStackSummary,
  PullRequestSummary,
  ReviewComment,
  TreeResult,
  UnstackPullRequestsResult,
} from '../dtos.js';

export type PullRequestReviewSide = 'LEFT' | 'RIGHT';
/** Review intent; adapters translate PENDING by omitting GitHub's event field. */
export type PullRequestReviewEvent =
  'PENDING' | 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

export type PullRequestReviewCommentTarget =
  | {
      readonly subjectType: 'line';
      readonly path: FilePath;
      readonly line: number;
      readonly side: PullRequestReviewSide;
      readonly startLine?: number;
      readonly startSide?: PullRequestReviewSide;
    }
  | {
      readonly subjectType: 'file';
      readonly path: FilePath;
    };

export interface PullRequestReviewDraftComment {
  readonly body: string;
  readonly path: FilePath;
  readonly line: number;
  readonly side: PullRequestReviewSide;
  readonly startLine?: number;
  readonly startSide?: PullRequestReviewSide;
}

/**
 * The outbound port for reading from and writing to GitHub.
 *
 * All methods receive already-validated domain values and return internal DTOs.
 * Implementations must throw {@link GitHubPortError} (never raw provider errors)
 * and must never return raw GitHub payloads.
 */
export interface GitHubRepositoryPort {
  checkPermissions(repo: RepoRef): Promise<PermissionCheck>;

  listTree(input: {
    readonly repo: RepoRef;
    readonly ref: GitRef;
    readonly recursive: boolean;
  }): Promise<TreeResult>;

  getFileContents(input: {
    readonly repo: RepoRef;
    readonly path: FilePath;
    readonly ref?: GitRef;
  }): Promise<FileContents>;

  searchCode(
    input: {
      readonly repo: RepoRef;
      readonly query: string;
    } & Pagination,
  ): Promise<CodeSearchResult>;

  listCommits(
    input: {
      readonly repo: RepoRef;
      readonly ref?: GitRef;
      readonly path?: FilePath;
    } & Pagination,
  ): Promise<readonly CommitListItem[]>;

  getCommit(input: {
    readonly repo: RepoRef;
    readonly sha: GitSha;
  }): Promise<CommitDetail>;

  listIssues(
    input: {
      readonly repo: RepoRef;
      readonly state: IssueState;
    } & Pagination,
  ): Promise<readonly IssueSummary[]>;

  getIssue(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
  }): Promise<Issue>;

  createIssue(input: {
    readonly repo: RepoRef;
    readonly title: string;
    readonly body?: string;
    readonly labels?: readonly string[];
  }): Promise<Issue>;

  closeIssue(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
  }): Promise<Issue>;

  updateIssue(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly title?: string;
    readonly body?: string;
    readonly state?: 'open' | 'closed';
    readonly stateReason?: IssueStateReason;
  }): Promise<Issue>;

  listIssueComments(
    input: {
      readonly repo: RepoRef;
      readonly issueNumber: IssueNumber;
    } & Pagination,
  ): Promise<readonly IssueComment[]>;

  createIssueComment(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly body: string;
  }): Promise<IssueComment>;

  listPullRequests(
    input: {
      readonly repo: RepoRef;
      readonly state: PullRequestState;
    } & Pagination,
  ): Promise<readonly PullRequestSummary[]>;

  getPullRequest(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
  }): Promise<PullRequest>;

  createPullRequest(input: {
    readonly repo: RepoRef;
    readonly title: string;
    readonly head: GitRef;
    readonly base: GitRef;
    readonly body?: string;
    readonly draft?: boolean;
  }): Promise<PullRequest>;

  closePullRequest(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
  }): Promise<PullRequest>;

  updatePullRequest(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly title?: string;
    readonly body?: string;
    readonly base?: GitRef;
  }): Promise<PullRequest>;

  listPullRequestFiles(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly PullRequestFile[]>;

  listPullRequestCommits(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly CommitListItem[]>;

  listPullRequestComments(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly ReviewComment[]>;

  createPullRequestReviewComment(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly body: string;
    readonly commitId: GitSha;
    readonly target: PullRequestReviewCommentTarget;
  }): Promise<ReviewComment>;

  createPullRequestReviewCommentReply(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly commentId: ReviewCommentId;
    readonly body: string;
  }): Promise<ReviewComment>;

  listPullRequestReviews(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly PullRequestReview[]>;

  createPullRequestReview(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly event: PullRequestReviewEvent;
    readonly commitId?: GitSha;
    readonly body?: string;
    readonly comments?: readonly PullRequestReviewDraftComment[];
  }): Promise<PullRequestReview>;

  listPullRequestStacks(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber?: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly PullRequestStackSummary[]>;

  getPullRequestStack(input: {
    readonly repo: RepoRef;
    readonly stackNumber: PullRequestStackNumber;
  }): Promise<PullRequestStack>;

  createPullRequestStack(input: {
    readonly repo: RepoRef;
    /** Pull request numbers ordered from the bottom of the stack to the top. */
    readonly pullNumbers: NewPullRequestStackMembers;
  }): Promise<PullRequestStack>;

  addPullRequestsToStack(input: {
    readonly repo: RepoRef;
    readonly stackNumber: PullRequestStackNumber;
    /** Pull request numbers to append, ordered from the current top upward. */
    readonly pullNumbers: PullRequestStackAdditions;
  }): Promise<PullRequestStack>;

  unstackPullRequests(input: {
    readonly repo: RepoRef;
    readonly stackNumber: PullRequestStackNumber;
  }): Promise<UnstackPullRequestsResult>;

  mergePullRequestAsync(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly mergeMethod?: PullRequestMergeMethod;
    readonly mergeAction?: PullRequestMergeAction;
    readonly commitTitle?: string;
    readonly commitMessage?: string;
    readonly expectedHeadSha?: GitSha;
  }): Promise<AsyncMergeSubmission>;

  getPullRequestMergeResult(input: {
    readonly repo: RepoRef;
    readonly pullNumber: PullRequestNumber;
    readonly mergeId: AsyncMergeId;
  }): Promise<AsyncMergeResult>;

  // Labels, assignees, and milestone are managed through GitHub's issues API
  // for both issues and pull requests: a pull request's number is its issue
  // number, so callers pass the relevant number as `issueNumber`.

  addLabels(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly labels: readonly string[];
  }): Promise<LabelSet>;

  removeLabel(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly label: string;
  }): Promise<LabelSet>;

  addAssignees(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly assignees: readonly string[];
  }): Promise<AssigneeSet>;

  removeAssignees(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly assignees: readonly string[];
  }): Promise<AssigneeSet>;

  setMilestone(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
    readonly milestone: number;
  }): Promise<MilestoneResult>;

  clearMilestone(input: {
    readonly repo: RepoRef;
    readonly issueNumber: IssueNumber;
  }): Promise<MilestoneResult>;

  getCombinedStatus(input: {
    readonly repo: RepoRef;
    readonly ref: GitRef;
  }): Promise<CombinedStatus>;

  listCheckRuns(input: {
    readonly repo: RepoRef;
    readonly ref: GitRef;
  }): Promise<readonly CheckRun[]>;
}
