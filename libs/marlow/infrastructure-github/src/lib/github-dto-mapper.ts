import type { Octokit } from 'octokit';
import {
  AssigneeSet,
  CheckRun,
  CodeSearchResult,
  CombinedStatus,
  CommitDetail,
  CommitSummary,
  FileContents,
  GitActor,
  Issue,
  IssueComment,
  LabelSet,
  MilestoneRef,
  MilestoneResult,
  PermissionCheck,
  PullRequest,
  PullRequestFile,
  TreeEntryType,
  TreeResult,
} from '@org/marlow-application';

// Single-source payloads are derived directly from Octokit so they stay in
// lock-step with the client. Shapes returned by several endpoints (commits,
// issues, comments, pull requests) are mapped via minimal structural
// interfaces, which keeps the mappers robust to Octokit's per-endpoint types.
type Rest = Octokit['rest'];
type Data<T extends Promise<{ data: unknown }>> = Awaited<T>['data'];

type RepoGetData = Data<ReturnType<Rest['repos']['get']>>;
type CommitGetData = Data<ReturnType<Rest['repos']['getCommit']>>;
type TreeData = Data<ReturnType<Rest['git']['getTree']>>;
type SearchCodeData = Data<ReturnType<Rest['search']['code']>>;
type PullFileItem = Data<ReturnType<Rest['pulls']['listFiles']>>[number];
type CombinedStatusData = Data<
  ReturnType<Rest['repos']['getCombinedStatusForRef']>
>;
type CheckRunsData = Data<ReturnType<Rest['checks']['listForRef']>>;

type GitActorInput = {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly date?: string | null;
} | null;

interface GhCommitLike {
  readonly sha: string;
  readonly commit: {
    readonly message: string;
    readonly author: GitActorInput;
    readonly committer: GitActorInput;
  };
}

type GhLabel = string | { readonly name?: string | null };
type GhAssignee = { readonly login: string } | null;
type GhMilestone = { readonly number: number; readonly title: string } | null;

interface GhIssueLike {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly body?: string | null;
  readonly user: { readonly login: string } | null;
  readonly labels: ReadonlyArray<GhLabel>;
  readonly assignees?: ReadonlyArray<GhAssignee> | null;
  readonly milestone?: GhMilestone;
  readonly comments: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface GhAssigneesLike {
  readonly assignees?: ReadonlyArray<GhAssignee> | null;
}

interface GhMilestoneLike {
  readonly milestone: GhMilestone;
}

interface GhCommentLike {
  readonly id: number;
  readonly user: { readonly login: string } | null;
  readonly body?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface GhPullLike {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly body: string | null;
  readonly user: { readonly login: string } | null;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly draft?: boolean;
  readonly merged?: boolean;
  readonly merged_at: string | null;
  readonly labels?: ReadonlyArray<GhLabel>;
  readonly assignees?: ReadonlyArray<GhAssignee> | null;
  readonly milestone?: GhMilestone;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface GhFileContent {
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly content: string;
}

const mapActor = (actor: GitActorInput): GitActor | null =>
  actor == null
    ? null
    : {
        name: actor.name ?? '',
        email: actor.email ?? '',
        date: actor.date ?? '',
      };

const extractLabelNames = (labels: ReadonlyArray<GhLabel>): readonly string[] =>
  labels
    .map((label) => (typeof label === 'string' ? label : (label.name ?? null)))
    .filter((name): name is string => name !== null);

const extractAssigneeLogins = (
  assignees: ReadonlyArray<GhAssignee> | null | undefined,
): readonly string[] =>
  (assignees ?? [])
    .map((assignee) => assignee?.login ?? null)
    .filter((login): login is string => login !== null);

const extractMilestone = (
  milestone: GhMilestone | undefined,
): MilestoneRef | null =>
  milestone == null
    ? null
    : { number: milestone.number, title: milestone.title };

export const mapPermissionCheck = (data: RepoGetData): PermissionCheck => {
  const canAdmin = data.permissions?.admin ?? false;
  const canWrite = data.permissions?.push ?? false;
  const canRead = data.permissions?.pull ?? false;
  const permission = canAdmin
    ? 'admin'
    : canWrite
      ? 'write'
      : canRead
        ? 'read'
        : 'none';
  return { fullName: data.full_name, permission, canRead, canWrite, canAdmin };
};

export const mapTree = (data: TreeData): TreeResult => ({
  sha: data.sha,
  truncated: data.truncated,
  entries: data.tree.map((entry) => ({
    path: entry.path ?? '',
    type: (entry.type ?? 'blob') as TreeEntryType,
    sha: entry.sha ?? '',
    mode: entry.mode ?? '',
    size: entry.size,
  })),
});

export const mapFileContents = (data: GhFileContent): FileContents => {
  const buffer = Buffer.from(data.content, 'base64');
  const isBinary = buffer.includes(0);
  return {
    path: data.path,
    sha: data.sha,
    size: data.size,
    encoding: isBinary ? 'base64' : 'utf-8',
    content: isBinary ? buffer.toString('base64') : buffer.toString('utf8'),
  };
};

export const mapCodeSearch = (data: SearchCodeData): CodeSearchResult => ({
  totalCount: data.total_count,
  incompleteResults: data.incomplete_results,
  items: data.items.map((item) => ({
    fullName: item.repository.full_name,
    path: item.path,
    sha: item.sha,
  })),
});

export const mapCommitSummary = (data: GhCommitLike): CommitSummary => ({
  sha: data.sha,
  message: data.commit.message,
  author: mapActor(data.commit.author),
  committer: mapActor(data.commit.committer),
});

export const mapCommitDetail = (data: CommitGetData): CommitDetail => ({
  ...mapCommitSummary(data),
  stats: {
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
    total: data.stats?.total ?? 0,
  },
  files: (data.files ?? []).map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
  })),
});

export const mapIssue = (data: GhIssueLike): Issue => ({
  number: data.number,
  title: data.title,
  state: data.state,
  body: data.body ?? null,
  author: data.user?.login ?? null,
  labels: extractLabelNames(data.labels),
  assignees: extractAssigneeLogins(data.assignees),
  milestone: extractMilestone(data.milestone),
  commentCount: data.comments,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

export const mapIssueComment = (data: GhCommentLike): IssueComment => ({
  id: data.id,
  author: data.user?.login ?? null,
  body: data.body ?? '',
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

export const mapPullRequest = (data: GhPullLike): PullRequest => ({
  number: data.number,
  title: data.title,
  state: data.state,
  body: data.body ?? null,
  author: data.user?.login ?? null,
  headRef: data.head.ref,
  baseRef: data.base.ref,
  draft: data.draft ?? false,
  merged: data.merged ?? data.merged_at != null,
  labels: extractLabelNames(data.labels ?? []),
  assignees: extractAssigneeLogins(data.assignees),
  milestone: extractMilestone(data.milestone),
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

export const mapPullRequestFile = (data: PullFileItem): PullRequestFile => ({
  filename: data.filename,
  status: data.status,
  additions: data.additions,
  deletions: data.deletions,
  changes: data.changes,
});

export const mapCombinedStatus = (
  data: CombinedStatusData,
): CombinedStatus => ({
  state: data.state,
  totalCount: data.total_count,
  statuses: data.statuses.map((status) => ({
    context: status.context,
    state: status.state,
    description: status.description ?? null,
    targetUrl: status.target_url ?? null,
  })),
});

export const mapCheckRuns = (data: CheckRunsData): readonly CheckRun[] =>
  data.check_runs.map((run) => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion ?? null,
  }));

export const mapLabelSet = (labels: ReadonlyArray<GhLabel>): LabelSet => ({
  labels: extractLabelNames(labels),
});

export const mapAssigneeSet = (data: GhAssigneesLike): AssigneeSet => ({
  assignees: extractAssigneeLogins(data.assignees),
});

export const mapMilestoneResult = (data: GhMilestoneLike): MilestoneResult => ({
  milestone: extractMilestone(data.milestone),
});
