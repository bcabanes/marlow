import {
  FilePath,
  GitRef,
  GitSha,
  IssueNumber,
  PullRequestNumber,
  RepoRef,
} from '@org/marlow-domain';
import {
  AssigneeSet,
  CheckRun,
  CodeSearchResult,
  CombinedStatus,
  CommitDetail,
  CommitSummary,
  FileContents,
  Issue,
  IssueComment,
  IssueState,
  IssueStateReason,
  LabelSet,
  MilestoneResult,
  Pagination,
  PermissionCheck,
  PullRequest,
  PullRequestFile,
  PullRequestState,
  TreeResult,
} from '../dtos.js';

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
  ): Promise<readonly CommitSummary[]>;

  getCommit(input: {
    readonly repo: RepoRef;
    readonly sha: GitSha;
  }): Promise<CommitDetail>;

  listIssues(
    input: {
      readonly repo: RepoRef;
      readonly state: IssueState;
    } & Pagination,
  ): Promise<readonly Issue[]>;

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
  ): Promise<readonly PullRequest[]>;

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
  ): Promise<readonly CommitSummary[]>;

  listPullRequestComments(
    input: {
      readonly repo: RepoRef;
      readonly pullNumber: PullRequestNumber;
    } & Pagination,
  ): Promise<readonly IssueComment[]>;

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
