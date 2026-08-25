# Marlow

**Least-privilege GitHub access for LLMs.**

Marlow is a local HTTP service that lets an LLM read and write a _fixed_ set of
private GitHub repositories — and nothing else. Every request is validated, every
repository is checked against a closed allow-list before GitHub is ever
contacted, write operations require explicit confirmation, and the token is held
only in memory.

It is deliberately small: a JSON-only API meant to run on your machine. No CLI,
no MCP server, no UI, no database, no background workers.

```
2  repositories on the allow-list      7  Nx projects (1 app, 6 libraries)
40 repo-scoped use cases               0  tokens written to disk
```

## Why

Handing an autonomous agent a GitHub token is handing it the keys to everything
that token can reach. Marlow narrows that down to a key that opens two doors. The
boundary lives in the domain layer — before any network call or credential read —
so "which repositories may this agent touch?" is answered by code, not by trust.

## Security model

The whole point is what Marlow _won't_ do.

- **Closed allow-list.** Only `nrwl/ocean` and `nrwl/nx` are reachable
  (`libs/marlow/domain/src/lib/allowed-repos.ts`). Any other repository is
  rejected with `403 repo_not_allowed` inside the use case, before the GitHub
  client is ever built.
- **The token only lives in memory.** Marlow reads it once from
  `MARLOW_GITHUB_TOKEN` and keeps it in memory — never logged, never written to
  disk.
- **Writes require confirmation.** Creating or closing an issue, comment, or pull
  request requires `{ "confirm": true }` in the body, or returns
  `400 validation_failed`.
- **No raw GitHub payloads.** Every response is mapped to a small internal DTO;
  upstream fields and error text never pass straight through to the caller.
- **Bring your own secret source.** Marlow asks only for a token. Fetch it however
  you trust — pass-cli, 1Password, Vault, a CI secret — Marlow neither knows nor
  cares where it came from.
- **Sanitized failures.** Errors surface a stable code and status, never a stack
  trace, a secret, or the raw request.

## How it works

DDD-lite with Nx libraries. Dependencies point inward: the domain depends on
nothing internal, and the app is the composition root that wires everything
together.

```
apps/
  marlow-api/                  HTTP server (Fastify) + composition root

libs/marlow/
  domain/                      allow-list, value objects, Result, errors
  application/                 use cases + ports (GitHubRepositoryPort, …)
  infrastructure-github/       Octokit client, adapter, GH→DTO + error mapping
  infrastructure-credentials/  static token provider (bring your own source)
  api-contracts/               Zod request/response schemas
  api-errors/                  ApiError, codes, HTTP status map, serialization
```

Module boundaries are enforced with Nx tags (`scope:marlow`, `type:domain`,
`type:application`, `type:infrastructure`, `type:contracts`, `type:util`,
`type:app`) in `eslint.config.mjs` — infrastructure may depend on the application
and domain, never the reverse.

Every request walks the same path:

1. **Validate input** — Zod parses params, query, and body.
2. **Build value objects** — `RepoRef`, `GitRef`, `GitSha`, `FilePath`,
   `IssueNumber`, …
3. **Check the allow-list** — a disallowed repo stops here with `403`, before any
   token read or network call.
4. **Resolve the token** — read from the environment, held in memory.
5. **Call GitHub** — through the Octokit adapter.
6. **Map to a DTO and respond** — JSON only, no raw payloads.

## Quick start

```sh
# install workspace dependencies
pnpm install

# rebuild + serve the API (development)
pnpm nx serve marlow-api
```

For production, bundle to a single self-contained file and run it with the token
in the environment:

```sh
pnpm nx build marlow-api
MARLOW_GITHUB_TOKEN=… node apps/marlow-api/dist/main.js
```

Marlow binds `127.0.0.1` by default. Keep it on loopback unless you put your own
authentication in front.

## Configuration

Configuration is read once at startup (`apps/marlow-api/src/app/config.ts`). The
only credential is `MARLOW_GITHUB_TOKEN`; everything else has a sensible default.

| Variable                   | Required | Default     | Description                                           |
| -------------------------- | -------- | ----------- | ----------------------------------------------------- |
| `MARLOW_GITHUB_TOKEN`      | yes      | —           | GitHub token. Supply it however you like (see below). |
| `MARLOW_HOST`              | no       | `127.0.0.1` | Bind address. Keep on loopback by default.            |
| `MARLOW_PORT`              | no       | `3000`      | Port to listen on.                                    |
| `NODE_ENV`                 | no       | —           | `production` suppresses 5xx detail in responses.      |
| `MARLOW_GITHUB_USER_AGENT` | no       | `marlow`    | User agent sent by the Octokit client.                |
| `MARLOW_GITHUB_BASE_URL`   | no       | —           | GitHub API base URL, e.g. for GitHub Enterprise.      |

### Creating the token

Marlow only reads `MARLOW_GITHUB_TOKEN` and doesn't care what kind of token it
is. Two ways to mint one, each with the permissions pre-filled.

**Fine-grained token — least privilege.** Scoped to a single owner and only the
permissions Marlow actually uses:

**[→ Create a fine-grained token](https://github.com/settings/personal-access-tokens/new?name=Marlow&description=Least-privilege%20access%20to%20allow-listed%20repos&target_name=nrwl&contents=write&issues=write&pull_requests=write&statuses=read)**

The link pre-selects the `nrwl` resource owner and **Contents** (read/write,
required by GitHub's asynchronous merge endpoint),
**Issues** (read/write), **Pull requests** (read/write), and **Commit statuses**
(read); **Metadata** (read) is added automatically. Two things the URL can't
pre-fill, so set them on the page:

- under **Repository access**, choose _Only select repositories_ → `nrwl/ocean`
  and `nrwl/nx`;
- add **Checks** (read) — required by the check-runs endpoint, but GitHub leaves
  it out of template URLs.

Fine-grained tokens against an organization require that org to allow them, which
sometimes needs admin approval.

**Classic token — simpler, coarser.** One scope, works everywhere, but it grants
full control of _all_ your private repositories — only Marlow's allow-list, not
the token, keeps it to two repos:

**[→ Create a classic token](https://github.com/settings/tokens/new?description=Marlow%20GitHub%20API%20broker&scopes=repo)**

The `repo` scope is required because the allow-list includes a private repository
(`nrwl/ocean`). If `nrwl` enforces SAML SSO, authorize the token afterwards.

Marlow is agnostic about where the token comes from — it only reads
`MARLOW_GITHUB_TOKEN`. Supply it however you trust:

```sh
# inject it for the process lifetime with Proton Pass
pass-cli run -- node apps/marlow-api/dist/main.js

# or via command substitution from any secret source
MARLOW_GITHUB_TOKEN="$(pass-cli item view <ref> --field token)" node apps/marlow-api/dist/main.js
```

## API

All repository routes are scoped to `/repos/:owner/:repo` and only succeed for
allow-listed repositories. Errors share one shape:
`{ "error": { "code", "message", "details?" } }`. Marlow describes itself at
`GET /openapi.json` (OpenAPI 3.1), so an agent can discover every route at
runtime.

| Method | Path                                                                | Does                                                            |
| ------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| GET    | `/openapi.json`                                                     | OpenAPI 3.1 description of this API                             |
| GET    | `/health`                                                           | Liveness check                                                  |
| GET    | `/repos`                                                            | List the allow-listed repos                                     |
| GET    | `/repos/:owner/:repo/permissions`                                   | Token's permissions on the repo                                 |
| GET    | `/repos/:owner/:repo/tree?ref=&recursive=`                          | List the tree at a ref                                          |
| GET    | `/repos/:owner/:repo/contents/*?ref=`                               | Read a file                                                     |
| GET    | `/repos/:owner/:repo/search/code?query=`                            | Search code, scoped to the repo                                 |
| GET    | `/repos/:owner/:repo/commits?ref=&path=`                            | List commits (subject line only)                                |
| GET    | `/repos/:owner/:repo/commits/:sha`                                  | A commit with stats and files                                   |
| GET    | `/repos/:owner/:repo/issues?state=`                                 | List issues (summaries, no body)                                |
| GET    | `/repos/:owner/:repo/issues/:issueNumber`                           | Get one issue                                                   |
| POST   | `/repos/:owner/:repo/issues`                                        | Create an issue · **confirm**                                   |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/close`                     | Close an issue · **confirm**                                    |
| GET    | `/repos/:owner/:repo/issues/:issueNumber/comments`                  | List issue comments                                             |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/comments`                  | Comment on an issue · **confirm**                               |
| PATCH  | `/repos/:owner/:repo/issues/:issueNumber`                           | Edit an issue's title/body/state · **confirm**                  |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/labels`                    | Add labels to an issue · **confirm**                            |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/labels/:name`              | Remove a label from an issue · **confirm**                      |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/assignees`                 | Add assignees to an issue · **confirm**                         |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/assignees`                 | Remove assignees from an issue · **confirm**                    |
| PUT    | `/repos/:owner/:repo/issues/:issueNumber/milestone`                 | Set an issue's milestone · **confirm**                          |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/milestone`                 | Clear an issue's milestone · **confirm**                        |
| GET    | `/repos/:owner/:repo/pulls?state=`                                  | List pull requests (summaries, no body)                         |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber`                             | Get one pull request                                            |
| POST   | `/repos/:owner/:repo/pulls`                                         | Open a pull request · **confirm**                               |
| PUT    | `/repos/:owner/:repo/pulls/:pullNumber/merge-async`                 | Atomically merge a PR and its stack below it · **confirm**      |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/merge-async/:mergeId`        | Poll an asynchronous merge                                      |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/close`                       | Close a pull request · **confirm**                              |
| PATCH  | `/repos/:owner/:repo/pulls/:pullNumber`                             | Update a PR's title/body/base · **confirm**                     |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/files`                       | Files changed in a PR                                           |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/commits`                     | Commits in a PR                                                 |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/comments`                    | Review comments anchored to a PR diff                           |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/comments`                    | Add an immediate line/range/file review comment · **confirm**   |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/comments/:commentId/replies` | Reply to a top-level review comment · **confirm**               |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/reviews`                     | Reviews (verdicts) on a PR                                      |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/reviews`                     | Create pending/submitted review + inline comments · **confirm** |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/labels`                      | Add labels to a PR · **confirm**                                |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/labels/:name`                | Remove a label from a PR · **confirm**                          |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/assignees`                   | Add assignees to a PR · **confirm**                             |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/assignees`                   | Remove assignees from a PR · **confirm**                        |
| PUT    | `/repos/:owner/:repo/pulls/:pullNumber/milestone`                   | Set a PR's milestone · **confirm**                              |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/milestone`                   | Clear a PR's milestone · **confirm**                            |
| GET    | `/repos/:owner/:repo/stacks?pullNumber=`                            | List PR stacks, optionally filtering by member PR               |
| GET    | `/repos/:owner/:repo/stacks/:stackNumber`                           | Get one PR stack                                                |
| POST   | `/repos/:owner/:repo/stacks`                                        | Link an ordered PR chain as a stack · **confirm**               |
| POST   | `/repos/:owner/:repo/stacks/:stackNumber/add`                       | Append PRs to a stack · **confirm**                             |
| POST   | `/repos/:owner/:repo/stacks/:stackNumber/unstack`                   | Remove eligible PRs from a stack · **confirm**                  |
| GET    | `/repos/:owner/:repo/commit-status?ref=`                            | Combined commit status                                          |
| GET    | `/repos/:owner/:repo/check-runs?ref=`                               | Check runs for a ref                                            |

Endpoints marked **confirm** require `{ "confirm": true }` in the request body.

List endpoints return trimmed rows to keep responses small for an LLM: issues
and pull requests omit the `body`, and commits carry only the subject line
(`messageHeadline`). Fetch a single issue, pull request, or commit to get the
full body or message. Paginated lists default to 30 rows per page (`perPage`,
max 100).

Pull requests carry `headSha`, `requestedReviewers` (logins), and
`requestedTeams` (slugs) alongside `assignees`, mirroring GitHub's PR object.
Use the observed `headSha` as `commitId` when adding an immediate review comment;
it is also recommended for grouped reviews with inline comments so a concurrent
head update cannot silently change the intended anchor.

Review-comment writes use modern blob line anchors: `RIGHT` for additions and
current/context lines, `LEFT` for deletions, and paired `startLine`/`startSide`
for ranges. File comments use `subjectType: "file"` without line fields. The
legacy diff `position` field is deliberately unsupported. As with GitHub,
omitting `event` creates a pending review; Marlow also accepts explicit
`PENDING`. `COMMENT`, `APPROVE`, and `REQUEST_CHANGES` retain their submitted
review behavior. Pending reviews omit GitHub's event field, leaving the review
and every supplied inline comment unsubmitted and visible only to the
authenticated reviewer until submission, without review notifications. The
returned `htmlUrl` opens the review in GitHub so it can be inspected, edited,
and submitted.

Pull requests also carry a nullable `stack` object with the repository-scoped
stack number, total size, one-based position, and ultimate base branch/SHA.
Stack endpoints accept pull request numbers from bottom to top. GitHub's stacked
PR feature is currently in public preview and returns `404` when it is not
enabled for the repository. To merge a stacked PR, submit the asynchronous merge
endpoint and poll its returned `id` while `status` is `pending`; GitHub merges or
queues every PR through the selected position atomically.

GitHub provides no idempotency key for these writes. A network failure can leave
the outcome ambiguous, and the shared Octokit client may retry some failures, so
inspect the PR's comments/reviews before retrying. Finding a matching comment is
useful evidence, not a formal exactly-once guarantee.

The reviews endpoint returns each verdict's reviewer, `state` (`APPROVED` /
`CHANGES_REQUESTED` / `COMMENTED` / `DISMISSED` / `PENDING`), note, and
timestamp. GitHub's REST API exposes no per-PR code-owner resolution; owners it
auto-requested already appear in `requestedReviewers`/`requestedTeams`, and the
`CODEOWNERS` file itself is readable via the contents endpoint.

### Discovery for agents

`GET /openapi.json` is the full, self-describing schema, but it is ~25 KB — a
recurring cost for an agent that re-fetches it every session. For routine use,
paste [`docs/agent-cheatsheet.md`](docs/agent-cheatsheet.md) into the agent's
always-loaded instructions (for example a global `CLAUDE.md`): it lists every
route on one line, so the agent rides the prompt cache and only fetches
`/openapi.json` for the details a cheat-sheet line doesn't cover. The cheat-sheet
is generated from the same route table as the OpenAPI document and guarded by a
test, so the two can't drift.

## Built with

| Tool       | Role                                                             |
| ---------- | ---------------------------------------------------------------- |
| Nx         | Monorepo workspace and task runner, on TypeScript project refs.  |
| TypeScript | Strict mode across every library and the app.                    |
| Fastify    | The HTTP server and the composition root.                        |
| Zod        | Request validation at the edge — params, query, and body.        |
| Octokit    | The GitHub client, hidden behind a port and a DTO mapper.        |
| Vitest     | Tests at every layer, including the security boundary itself.    |
| esbuild    | Bundles the app and its source libraries into one runnable file. |

## Development

```sh
pnpm nx run-many -t typecheck test lint   # every project
pnpm nx build marlow-api                   # bundled server
```

Tests cover the security boundary at the domain, application, and HTTP layers.

---

_A narrow door, held open on purpose._
