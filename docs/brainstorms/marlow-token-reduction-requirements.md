---
title: Reduce LLM token consumption when using Marlow (zero-surface)
status: draft
created: 2026-06-06
scope: standard
---

# Reduce LLM token consumption when using Marlow

## Problem

An LLM using Marlow pays tokens in two predictable places:

1. **Discovery (recurring, per-session).** Global `~/.claude/CLAUDE.md` instructs the agent to
   `GET /openapi.json` first. That document is **18,198 bytes (~4.5–5K tokens)** and enters
   context **uncached, via a tool round-trip, every session** Marlow is touched.
2. **List payloads (recurring, variable).** `listIssues`/`listPullRequests` return the full
   `Issue`/`PullRequest` DTO — including the entire `body` markdown — for every row
   (`libs/marlow/infrastructure-github/src/lib/github-repository.adapter.ts`,
   `mapIssue`/`mapPullRequest`). `listCommits`/`listPullRequestCommits` return the full commit
   `message`. A 30-row list is frequently 4–15K tokens, most of it free text the agent didn't ask for.

## Constraint (non-negotiable)

**Zero new API surface.** No new params, no projection/field-selection, no alternate formats, no
query endpoints, no new routes. The whole point of Marlow is least-privilege minimalism; token work
must come from *returning less by default* and *slimming discovery*, never from adding levers.
The field-stripping security guarantee (raw GitHub payloads never leak; see the
`secret_internal_field` test in `github.spec.ts`) must be preserved.

## Goals

- Cut the recurring per-session discovery cost.
- Cut list-payload size by dropping unbounded free-text from list rows.
- Make page size explicit and predictable.
- Keep the agent's contract honest: a field that isn't returned must be *absent from the type*, not
  returned as `null` (which would conflate "empty" with "not fetched").

## Decisions (resolved in brainstorm)

### D1 — List endpoints return summary DTOs; body/message omitted entirely
Split the one-DTO-per-entity model into **list-summary vs detail**:

- New `IssueSummary` = `Issue` minus `body`. `listIssues` → `IssueSummary[]`; `getIssue` → `Issue` (full body).
- New `PullRequestSummary` = `PullRequest` minus `body`. `listPullRequests` → `PullRequestSummary[]`;
  `getPullRequest` → `PullRequest`.
- Commits: list rows keep the **subject headline only** (first line of the message), full multi-line
  message via `getCommit` → `CommitDetail`. (Commits differ from issues/PRs: an empty message is
  useless, so we truncate to the headline rather than omit — same principle, drop the unbounded part.)

Rationale: the type tells the truth ("body not here — call `getIssue`"); summaries strip *strictly
more* fields than today, so the security guarantee is preserved/strengthened. Small structured fields
(labels, assignees, milestone, state, refs, counts, timestamps) stay — they're cheap and useful for triage.

### D2 — Generated cheat-sheet + slimmed on-demand doc
- Add `buildCheatSheet(endpoints)` driven by the **same `endpoints[]` array** that feeds
  `buildOpenApiDocument()` (`apps/marlow-api/src/app/openapi.ts`) — one terse line per route
  (method, path, query keys, required body keys, returns type, write marker).
- Emit it to a committed repo file (`docs/agent-cheatsheet.md`) and **drift-guard it** with a test
  mirroring `openapi.spec.ts`, so it can never diverge from the real routes.
- `$ref`-deduplicate the OpenAPI doc: extract `components/parameters` (owner, repo, issueNumber,
  pullNumber, page, perPage, state, ref, sha, path, recursive, label name) and
  `components/requestBodies` (confirm + the distinct write bodies); replace the inlined copies.
  Estimated 18KB → ~12–13KB. Drift guard checks paths/methods, not internals, so it still passes.
- **Posture shift:** the cheat-sheet becomes the primary reference; the full doc is fetched only for
  details a route's cheat-sheet line doesn't cover. The repo ships the artifact + wiring instructions;
  the **user** pastes/links it into their global `~/.claude/CLAUDE.md` (the repo's own `CLAUDE.md` is
  Nx-specific and never loads for an agent working in `nrwl/ocean`/`nrwl/nx`).

### D3 — Explicit default page size
Default `perPage` to **30** in `paginationQuerySchema`
(`libs/marlow/api-contracts/src/lib/common.schema.ts`, `.default(30)`), applied uniformly. Today
there's no default, so GitHub's implicit default (30) silently applies. This makes cost predictable
and is the *only* zero-surface lever for the comment-list endpoints (whose bodies can't be stripped —
the body is what you asked for). One-line change; trivially re-tunable later.

## Scope boundaries (non-goals)

- **No tree / file-contents trimming.** `listTree(recursive)` and `getFileContents` are the largest
  tail-risk payloads, but there's no zero-surface way to trim them without a param or changing
  semantics. The existing >1MB contents guard stays. Out of scope.
- **No null/empty-field omission in JSON.** Marginal savings; a uniform, predictable response shape is
  worth more to an LLM consumer than the few saved tokens. Explicitly rejected.
- **No comment-body truncation.** `listIssueComments`/`listPullRequestComments` return what you asked
  for; only D3 (page size) applies there.
- **No edits to the user's global `~/.claude/CLAUDE.md`** as part of this repo work — that's user
  config. The repo provides the cheat-sheet + a README wiring section; the user wires it (handoff step).

## Success criteria

- `listIssues`/`listPullRequests` no longer return `body`; `listCommits`/`listPullRequestCommits`
  return headline-only messages. `getIssue`/`getPullRequest`/`getCommit` unchanged (full content).
- `IssueSummary`/`PullRequestSummary` (and a commit list type) exist as distinct DTOs; OpenAPI
  `returns` strings updated accordingly.
- `docs/agent-cheatsheet.md` is generated from `endpoints[]` and guarded by a drift test.
- `/openapi.json` byte size measurably reduced (record before/after; target ~30%).
- `perPage` has an explicit default of 30.
- README updated (response shapes + cheat-sheet wiring instructions).
- `pnpm nx run-many -t typecheck test lint` green across all 7 projects.
- Security: a summary-DTO equivalent of the `secret_internal_field` leak test holds.

## Risks / known gotchas

- **`mapCommitSummary` reuse.** It's spread into `mapCommitDetail` (`...mapCommitSummary(data)`).
  Do **not** truncate the message in `mapCommitSummary` — that would strip `getCommit` too. Add a
  separate list mapper / headline field for the list path.
- **Type ripple.** `Issue`/`PullRequest` are currently returned by both list and get; splitting the
  types touches the adapter, mappers, OpenAPI `returns`, and several specs (`github.spec.ts`,
  `use-cases.spec.ts`, `app.spec.ts`). Moderate, mechanical edit surface.
- **Cheat-sheet generation mechanism** (a write-and-assert snapshot test vs an nx generate target)
  is a /ce-plan decision.

## Affected areas (orientation, not a plan)

- `libs/marlow/application/src/lib/dtos.ts` — new summary DTOs.
- `libs/marlow/infrastructure-github/src/lib/github-dto-mapper.ts` — summary mappers + commit headline.
- `libs/marlow/infrastructure-github/src/lib/github-repository.adapter.ts` — list paths use summary mappers.
- `libs/marlow/api-contracts/src/lib/common.schema.ts` — `perPage` default.
- `apps/marlow-api/src/app/openapi.ts` — `$ref` dedup; `returns` updates; `buildCheatSheet`.
- `apps/marlow-api/src/app/openapi.spec.ts` + new cheat-sheet drift test.
- `docs/agent-cheatsheet.md` (new), `README.md`.
