# Stacked pull requests

## Usage

Marlow keeps GitHub's stack REST operations intact and adds one workflow-sized
operation for the behavior that `gh stack merge` normally coordinates:

```http
PUT /repos/{owner}/{repo}/stacks/{stackNumber}/merge-async
Content-Type: application/json

{ "confirm": true, "mergeAction": "default" }
```

The operation reads the stack, skips its already-merged bottom entries, rejects
the first draft or closed blocker, selects the top eligible pull request, and
submits GitHub's asynchronous merge once. A pending response names the pull
request and merge id and supplies the exact URL to poll:

```json
{
  "outcome": "submitted",
  "stackNumber": 42,
  "targetPullRequestNumber": 102,
  "skippedMergedPullRequestNumbers": [101],
  "merge": {
    "status": "pending",
    "message": "Merge request enqueued.",
    "id": "630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42"
  },
  "next": {
    "method": "GET",
    "url": "/repos/nrwl/nx/pulls/102/merge-async/630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42"
  }
}
```

Marlow returns GitHub's meaningful status semantics on the raw operations:

- asynchronous merge returns `202` for a new request, `200` for an immediate
  merged or enqueued result, `400` for an immediate failure, and `409` for an
  existing request;
- unstack returns `200` with the remaining stack or `204` when dissolved;
- concurrent stack mutation returns `409`.

Every non-empty response is a discriminated JSON object. Callers do not need to
infer a state from optional fields or from HTTP status alone.

## Problem

Marlow already covered GitHub's five stack REST operations and asynchronous
pull-request merge endpoints. The missing feature set was semantic: detail
responses were collapsed into the smaller list shape, provider payloads were
trusted with TypeScript casts, asynchronous outcomes formed an invalid-state
optional-field bag, useful `200`/`202`/`204`/`400`/`409` distinctions were lost,
and an LLM had to recreate `gh stack merge` target-selection policy itself.

## Shape

The existing Marlow boundary stays in place:

```text
HTTP route -> application use case -> GitHubRepositoryPort -> Octokit adapter
```

The load-bearing types are:

```ts
type AsyncMergeResult =
  | { status: 'pending'; message: string; id: string /* request details */ }
  | { status: 'merged'; message: string; mergeCommitSha: string }
  | { status: 'enqueued'; message: string }
  | { status: 'failed'; message: string };

type AsyncMergeSubmission =
  | { outcome: 'accepted'; merge: AsyncMergePending }
  | { outcome: 'completed'; merge: AsyncMergeMerged | AsyncMergeEnqueued }
  | { outcome: 'rejected'; merge: AsyncMergeFailed }
  | { outcome: 'alreadyPending'; merge: AsyncMergePending };

type UnstackPullRequestsResult =
  { outcome: 'dissolved' } | { outcome: 'updated'; stack: PullRequestStack };
```

The port owns provider-neutral outcomes. Only routes translate those outcomes
to HTTP statuses. The adapter validates all preview response payloads at the
network boundary. Stack list rows and stack detail/write responses use distinct
DTOs because GitHub itself returns distinct shapes.

`mergePullRequestStack` is the only new coordinator. It does not long-poll and
does not persist merge state; the existing pull-level poll endpoint remains the
single source of truth for a supplied pull number and merge UUID.

## Synthesis

Four independent designs were requested. One candidate dropped out. The three
completed candidates were cross-scored for completeness, GitHub/`gh` fidelity,
LLM usability, Marlow fit, interface depth, and safety/testability.

Candidate 4 was selected as the base (29/30 versus 23/30 and 15/30). It kept
application results semantic while placing HTTP mapping at the route boundary.
Two useful details were grafted from the other candidates: concrete poll URLs
for generated tools, and caller-first OpenAPI wording around “show stack” and
“merge stack.”

Rejected ideas:

- HTTP status fields in application DTOs, because transport policy would leak
  below the route;
- a stack-level poll endpoint without an explicit merge UUID, because a
  stateless broker cannot recover that state reliably;
- hidden long-polling, because merges may take minutes and callers need a
  resumable operation;
- remote upsert/replacement, because unstack plus base edits plus recreation is
  a non-idempotent multi-write workflow that GitHub does not expose atomically;
- local Git branch manipulation, which belongs to `gh`, not this remote broker.

## Tradeoffs

- The stack merge endpoint deliberately uses GitHub's `mergeAction: "default"`
  when the caller does not choose an action. GitHub can then select direct merge
  or merge queue without Marlow adding GraphQL repository-policy discovery.
- The raw asynchronous merge endpoint remains public as an advanced escape
  hatch and as the explicit poll target.
- Runtime parsing adds a small private schema module in the GitHub adapter. That
  cost is preferable to letting preview API drift escape as malformed public
  data or incidental `TypeError`s.

## Verification

The implementation is complete when focused Nx tests prove:

- list and detail payloads preserve their distinct GitHub shapes;
- malformed preview payloads fail at the adapter boundary;
- create/add invariants hold for direct application callers as well as HTTP;
- add/unstack conflicts map to `409`, and dissolved unstack maps to `204`;
- all four asynchronous submission statuses preserve both body and HTTP code;
- stack merge skips merged bottoms, blocks draft/closed entries, selects the top
  eligible pull request, submits once, and returns an actionable poll URL;
- OpenAPI describes every success response with concrete schemas.
