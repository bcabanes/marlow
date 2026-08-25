---
title: PR reviewers surface + permissive-read decision
status: active
date: 2026-06-11
---

# PR reviewers surface, and the decision not to loosen reads

Two requests were raised together. One is **dropped on purpose** (recorded here so
it is not re-litigated); the other is a small, GitHub-faithful read addition.

## Request 1 — relax the allow-list so public repos are readable: DROPPED

The ask was: allow reads of any public repo, keep the allow-list only for writes
(public or private).

**Decision: not built.** Reads stay allow-list-gated, exactly as today.

**Why.** Marlow's entire value is the _privileged_ path — allow-list-gated,
token-backed access to a closed set of repos the agent otherwise cannot touch
(`libs/marlow/domain/src/lib/allowed-repos.ts`; the token is fetched lazily, only
after a repo passes the gate — `apps/marlow-api/src/app/dependencies.ts`,
`lazy-github-port.ts`). Public-repo data is reachable by anyone with an anonymous
`GET api.github.com/...`. A safe implementation (an _unauthenticated_ proxy for
non-allow-listed reads, so the token never leaves the allow-list cage) would add
only two things over a plain fetch: Marlow's trimmed DTO shape, and working inside
a no-outbound-network sandbox. Neither justifies splitting the gate into
read/write modes and adding a second client to a security-critical broker. The
carrying cost lands on the one component that must stay simple and auditable.

**What would reopen it.** A confirmed environment where the agent has no outbound
network but the Marlow host does — then relay becomes the only path and the
calculus flips. Not the case today.

## Request 2 — reviewers (and assignees) on PRs

Guidance: _follow REST best practice and how GitHub itself exposes things._

### Assignees — already shipped

`PullRequestSummary.assignees` and `PullRequest.assignees` already exist
(`libs/marlow/application/src/lib/dtos.ts`). No change.

### Requested reviewers — fields on the PR resource

GitHub carries `requested_reviewers` (users) and `requested_teams` (teams) **on the
PR object**, in both list and detail responses. Mirror that:

- Add `requestedReviewers` (user logins) and `requestedTeams` (team slugs) to
  `PullRequestSummary` (inherited by `PullRequest`).
- Keep users and teams as separate arrays, exactly as GitHub does.
- Placement on the _summary_ is consistent with `assignees` (already there) — both
  are small bounded login arrays, so this does not violate the token-lean summary
  rule that stripped large free-text bodies.

### Reviews (verdicts) — a sub-collection endpoint

The actual review verdicts are a sub-resource in GitHub
(`GET /pulls/{n}/reviews`). Mirror that with a new endpoint:

- `GET /repos/{owner}/{repo}/pulls/{pullNumber}/reviews ?page,perPage -> PullRequestReview[]`
- `PullRequestReview`: `id`, `author` (login | null), `state`
  (`APPROVED` / `CHANGES_REQUESTED` / `COMMENTED` / `DISMISSED` / `PENDING`,
  passed through from GitHub), `body` (the review note | null), `submittedAt`.
- `body` is **kept** here even though list endpoints elsewhere strip bodies: a
  review's body is its substance (the "changes requested" rationale) and is
  typically short, unlike issue/PR/commit free-text. Deliberate divergence.
- Read-only; allow-list-gated like every other read.

### Code owners — note only, nothing built

GitHub's REST API exposes **no per-PR / per-path code-owner resolution**. The only
REST surface is `GET /repos/{owner}/{repo}/codeowners/errors` (syntax validation).
Owner resolution happens inside GitHub and surfaces only as _auto-requested
reviewers_. So, faithful to "how GitHub exposes things":

- Owners GitHub auto-requested already appear in the new
  `requestedReviewers` / `requestedTeams`.
- The `CODEOWNERS` file itself is already readable via the existing
  `GET /repos/{owner}/{repo}/contents/{path}`.
- No bespoke endpoint or glob-matching resolver is added.

## Non-goals

- Unauthenticated / permissive public reads (Request 1, dropped).
- A `CODEOWNERS` parse endpoint or PR-to-owners resolver.
- A single-review fetch endpoint (`/reviews/{id}`).
- Exposing `requested_teams` as anything richer than slugs.

## Success criteria

- `GET /pulls/{n}` and `GET /pulls` return `requestedReviewers` and
  `requestedTeams`; existing `assignees` unchanged.
- `GET /pulls/{n}/reviews` returns reviewer + state + note + timestamp, gated by
  the allow-list, body-bearing.
- Reviews endpoint appears once in `endpoints`, the generated
  `docs/agent-cheatsheet.md`, and the OpenAPI document; drift guards stay green.
- All 7 projects pass typecheck / test / lint.

## Implementation-time decisions (for execution, not product)

- Reuse `paginationQuerySchema` + `pullNumberParamsSchema`; no new contract.
- Mapper stays structural (`GhReviewLike`) like the other mappers, robust to
  Octokit's per-endpoint types.
- Keep the global `~/.claude/CLAUDE.md` embedded cheat-sheet in sync with the new
  route.
