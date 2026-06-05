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

export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly body: string | null;
  readonly author: string | null;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly milestone: MilestoneRef | null;
  readonly commentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IssueComment {
  readonly id: number;
  readonly author: string | null;
  readonly body: string;
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

export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly body: string | null;
  readonly author: string | null;
  readonly headRef: string;
  readonly baseRef: string;
  readonly draft: boolean;
  readonly merged: boolean;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly milestone: MilestoneRef | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PullRequestFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
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
