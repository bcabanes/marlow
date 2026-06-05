# Residual Review Findings — feat/marlow-broker

Source: `ce-code-review mode:autofix` (run `20260605-122544-marlow`), 9 persona reviewers over the initial Marlow implementation. No PR/remote exists in this environment, so this committed file is the durable record. Findings below were validated as real but **not** applied in the review pass (they need behavior changes, design decisions, or broader test work). Items the review **did** fix are listed first for context.

## Fixed in this review pass

- **P0 — Code-search allow-list bypass.** `searchCode` concatenated raw user `query` into the GitHub search `q` alongside `repo:owner/repo`; GitHub ORs scope qualifiers, so `query="x org:stripe"` reached non-allow-listed repos. Added `createSearchQuery` (domain) rejecting `repo:`/`org:`/`user:`/`fork:` qualifiers, enforced in the `searchCode` use case. Tests added at domain + use-case + (implicitly) HTTP layers.
- **P2 — `getFileContents` silent empty content** for files >1 MB (GitHub `encoding:'none'`). Adapter now throws `unprocessable` when `encoding !== 'base64'`.
- **P2 — `listCheckRuns` truncation** at GitHub's default 30. Added `per_page: 100`.
- **P2 — `CredentialError` → opaque 500.** Error handler now maps it to `502 upstream_unavailable`.
- **P1 (tests) — Allow-list / confirm coverage.** Added a parameterized allow-list-rejection test across all 21 repo-scoped use cases, and confirm:true HTTP gating tests for all 5 write endpoints.

## Residual — reliability / correctness

- **P1 `libs/marlow/infrastructure-github/src/lib/github-client.ts` — no GitHub request timeout.** Octokit v5 uses global `fetch` with no timeout; a stalled GitHub response hangs the request indefinitely. Needs a custom `fetch` wired with `AbortSignal.timeout(...)` (plus a `MARLOW_GITHUB_REQUEST_TIMEOUT_MS` config). Not applied because the correct fix is a non-trivial fetch override, not a constructor flag.
- **P2 `apps/marlow-api/src/app/dependencies.ts` — credential cache stampede.** On a cold/expired cache, concurrent requests each spawn `pass-cli` and rebuild Octokit. Add single-flight (in-flight `Promise`) dedup in `resolvePort`.
- **P2 `apps/marlow-api/src/app/main.ts` — no graceful shutdown / `unhandledRejection` handler.** Add `SIGTERM`/`SIGINT` → `server.close()` and a logged `unhandledRejection` handler.
- **P3 `apps/marlow-api/src/app/config.ts` — `MARLOW_PASS_TIMEOUT_MS` accepts `0`**, which disables the `execFile` timeout. Tighten to `.min(1)`.

## Residual — API contract / types

- **P2 `apps/marlow-api/src/app/error-mapping.ts` — non-exhaustive `domainErrorToApiError`.** Current behavior is correct (all non-`repo_not_allowed` codes are validation failures → 400), but a future `DomainErrorCode` would silently map to 400. Convert to an exhaustive `switch` with an `assertNever` default. (Same hardening applies to `githubErrorToApiError`.)
- **P2 — no Fastify response schemas.** DTOs are mapped (no raw GitHub fields today), so this is defense-in-depth: register response schemas so any future adapter-superset field is stripped rather than becoming an implicit contract.
- **P2 `libs/marlow/application/src/lib/dtos.ts` — string-typed enums.** `PermissionCheck.permission`, `Issue.state`, `PullRequest.state`, `CheckRun.status/conclusion` are `string`; narrow to literal unions to give callers a discriminant and catch mapper drift.
- **P3 — production 4xx detail suppression / input echo.** In prod (`exposeInternals:false`) Zod `details` are dropped for 4xx too (clients lose field-level info), while 4xx messages echo raw input. Decide the intended client contract.

## Residual — security (defense in depth)

- **P2 `apps/marlow-api/src/app/config.ts` — no API authentication.** `MARLOW_HOST` defaults to loopback (safe), but binding a non-loopback address exposes the unauthenticated broker (writes included). Validate host to loopback or require a bearer token when non-loopback.
- **Advisory — token scope.** Recommend a fine-grained PAT limited to `nrwl/ocean` and `nrwl/nx` so a bug never grants broader blast radius than the allow-list intends.

## Residual — maintainability / tests

- **P2** `getGitHubPort` is a redundant `async` wrapper around a ready lazy port; could be a plain property.
- **P2/P3** Dead/over-exported surface: `CredentialCache.clear()` (unused), `GhFileContent` exported unnecessarily, `api-errors` `conflict`/`badRequest` (test-only), broad mapper re-exports from `infrastructure-github`.
- **P2 (tests)** Unit coverage gaps: `mapFileContents` binary/utf-8 + encoding guard, `mapPermissionCheck` permission ladder, adapter directory/non-file guard, `mapGitHubError` unknown-error + plain-403, credential cache TTL expiry, and `domainErrorToApiError`/`githubErrorToApiError` direct unit tests. No integration test exercises the real Octokit adapter (all HTTP tests inject a fake port).

## Dropped (validated false positive)

- "Missing `conflict` case in `githubErrorToApiError`" — there is no `conflict` `GitHubErrorKind`; the switch is already exhaustive over the eight kinds.
