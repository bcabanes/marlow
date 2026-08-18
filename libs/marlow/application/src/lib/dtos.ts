/**
 * Internal data-transfer objects exposed by the application layer.
 *
 * These are deliberately decoupled from raw GitHub API shapes: infrastructure
 * adapters map provider responses onto these types so the API layer never sees
 * provider-specific payloads.
 */

export interface Pagination {
  readonly page?: number;
  readonly perPage?: number;
}

export type IssueState = 'open' | 'closed' | 'all';
export type PullRequestState = 'open' | 'closed' | 'all';

export interface RepoSummary {
  readonly owner: string;
  readonly repo: string;
  readonly fullName: string;
}

export interface PermissionCheck {
  readonly fullName: string;
  readonly permission: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canAdmin: boolean;
}

export type TreeEntryType = 'blob' | 'tree' | 'commit';

export interface TreeEntry {
  readonly path: string;
  readonly type: TreeEntryType;
  readonly sha: string;
  readonly mode: string;
  readonly size?: number;
}

export interface TreeResult {
  readonly sha: string;
  readonly truncated: boolean;
  readonly entries: readonly TreeEntry[];
}

export type FileEncoding = 'utf-8' | 'base64';

export interface FileContents {
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly encoding: FileEncoding;
  readonly content: string;
}

export interface CodeSearchItem {
  readonly fullName: string;
  readonly path: string;
  readonly sha: string;
}

export interface CodeSearchResult {
  readonly totalCount: number;
  readonly incompleteResults: boolean;
  readonly items: readonly CodeSearchItem[];
}

export interface GitActor {
  readonly name: string;
  readonly email: string;
  readonly date: string;
}

export interface CommitSummary {
  readonly sha: string;
  readonly message: string;
  readonly author: GitActor | null;
  readonly committer: GitActor | null;
}

export interface CommitFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
}

export interface CommitStats {
  readonly additions: number;
  readonly deletions: number;
  readonly total: number;
}

export interface CommitDetail extends CommitSummary {
  readonly stats: CommitStats;
  readonly files: readonly CommitFile[];
}

/**
 * A commit as it appears in a list: the message is reduced to its subject
 * headline (the first line). Fetch a single commit for the full message.
 */
export interface CommitListItem {
  readonly sha: string;
  readonly messageHeadline: string;
  readonly author: GitActor | null;
  readonly committer: GitActor | null;
}

/**
 * An issue as it appears in a list: everything except the (potentially large)
 * body. Fetch a single issue to get the body.
 */
export interface IssueSummary {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly author: string | null;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly milestone: MilestoneRef | null;
  readonly commentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A full issue, including the body. Returned by single-issue reads and writes. */
export interface Issue extends IssueSummary {
  readonly body: string | null;
}

export interface IssueComment {
  readonly id: number;
  readonly author: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A review comment on a pull request: an inline remark anchored to the diff.
 * Unlike an {@link IssueComment} (a conversation comment on the PR thread), it
 * carries the diff anchor — file, line, side, and hunk — plus the threading
 * links that say which review and which prior comment it belongs to. This is
 * what `GET /pulls/{n}/comments` returns; conversation comments come from
 * `GET /issues/{n}/comments`.
 */
export interface ReviewComment {
  readonly id: number;
  readonly author: string | null;
  readonly body: string;
  /** Path of the file the comment is anchored to. */
  readonly path: string;
  /** Line in the diff's after-state, or null for a file-level comment. */
  readonly line: number | null;
  /** Line in the diff's before-state, or null. */
  readonly originalLine: number | null;
  /** LEFT | RIGHT — which side of the diff the line sits on, or null. */
  readonly side: string | null;
  /** First line of a multi-line comment range, or null when single-line. */
  readonly startLine: number | null;
  /** Side of the range's first line, or null. */
  readonly startSide: string | null;
  /** The diff hunk the comment was left against. */
  readonly diffHunk: string;
  /** SHA the comment is currently anchored to. */
  readonly commitId: string;
  /** SHA the comment was originally left against. */
  readonly originalCommitId: string;
  /** Id of the comment this one replies to, or null for a top-level comment. */
  readonly inReplyToId: number | null;
  /** Id of the review this comment belongs to, or null. */
  readonly pullRequestReviewId: number | null;
  /** Permalink to the comment's #discussion_r anchor. */
  readonly htmlUrl: string;
  /** line | file — whether the comment targets a line or the whole file. */
  readonly subjectType: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** State reasons accepted when editing an issue (mirrors GitHub's set). */
export type IssueStateReason = 'completed' | 'not_planned' | 'reopened';

/** The label set on an issue or pull request after a label mutation. */
export interface LabelSet {
  readonly labels: readonly string[];
}

/** The assignee set on an issue or pull request after an assignee mutation. */
export interface AssigneeSet {
  readonly assignees: readonly string[];
}

export interface MilestoneRef {
  readonly number: number;
  readonly title: string;
}

/** The milestone on an issue or pull request after a milestone mutation. */
export interface MilestoneResult {
  readonly milestone: MilestoneRef | null;
}

/** A pull request's membership and position within a GitHub PR stack. */
export interface PullRequestStackMembership {
  readonly id: number;
  readonly number: number;
  readonly size: number;
  /** One-based position, where 1 is the pull request closest to the base. */
  readonly position: number;
  readonly baseRef: string;
  readonly baseSha: string;
}

/**
 * A pull request as it appears in a list: everything except the (potentially
 * large) body. Fetch a single pull request to get the body.
 */
export interface PullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly author: string | null;
  readonly headRef: string;
  /** SHA at the pull request's head, used to anchor diff comments. */
  readonly headSha: string;
  readonly baseRef: string;
  readonly draft: boolean;
  readonly merged: boolean;
  /** Null for a standalone pull request. */
  readonly stack: PullRequestStackMembership | null;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  /** Logins asked to review but who have not necessarily acted yet. */
  readonly requestedReviewers: readonly string[];
  /** Team slugs asked to review (GitHub keeps these separate from users). */
  readonly requestedTeams: readonly string[];
  readonly milestone: MilestoneRef | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A full pull request, including the body. Returned by single-PR reads and
 * writes.
 */
export interface PullRequest extends PullRequestSummary {
  readonly body: string | null;
  /** Number of commits in the pull request. */
  readonly commits: number;
  /** Number of files the pull request changes. */
  readonly changedFiles: number;
}

/**
 * A single review (verdict) on a pull request. Unlike other list rows, the
 * `body` is kept: it carries the review's rationale and is typically short.
 */
export interface PullRequestReview {
  readonly id: number;
  readonly author: string | null;
  /** APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING. */
  readonly state: string;
  readonly body: string | null;
  readonly submittedAt: string | null;
  /** GitHub page for inspecting the review in the pull-request interface. */
  readonly htmlUrl: string;
}

export interface PullRequestFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
}

/** A compact pull request entry within a stack, ordered bottom to top. */
export interface PullRequestStackEntry {
  readonly number: number;
  readonly state: string;
  readonly draft: boolean;
  readonly mergedAt: string | null;
  readonly headRef: string;
  readonly headSha: string;
}

/** A repository-scoped GitHub pull-request stack. */
export interface PullRequestStack {
  readonly id: number;
  readonly number: number;
  readonly nodeId: string;
  readonly url: string;
  readonly baseRef: string;
  readonly open: boolean;
  readonly createdAt: string;
  /** Pull requests ordered from the stack's base toward its top. */
  readonly pullRequests: readonly PullRequestStackEntry[];
}

export type PullRequestMergeMethod = 'merge' | 'squash' | 'rebase';
export type PullRequestMergeAction = 'default' | 'direct_merge' | 'merge_queue';
export type AsyncMergeStatus = 'pending' | 'merged' | 'enqueued' | 'failed';

/** Provider-independent view of GitHub's asynchronous merge state. */
export interface AsyncMergeResult {
  readonly status: AsyncMergeStatus;
  readonly message: string;
  readonly id?: string;
  readonly mergeMethod?: PullRequestMergeMethod;
  readonly mergeAction?: PullRequestMergeAction;
  readonly expectedHeadSha?: string;
  readonly mergeCommitSha?: string;
}

export interface StatusEntry {
  readonly context: string;
  readonly state: string;
  readonly description: string | null;
  readonly targetUrl: string | null;
}

export interface CombinedStatus {
  readonly state: string;
  readonly totalCount: number;
  readonly statuses: readonly StatusEntry[];
}

export interface CheckRun {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
}
