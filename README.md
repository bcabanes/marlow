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
28 repo-scoped use cases               0  tokens written to disk
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

| Variable                   | Required | Default     | Description                                            |
| -------------------------- | -------- | ----------- | ------------------------------------------------------ |
| `MARLOW_GITHUB_TOKEN`      | yes      | —           | GitHub token. Supply it however you like (see below).  |
| `MARLOW_HOST`              | no       | `127.0.0.1` | Bind address. Keep on loopback by default.             |
| `MARLOW_PORT`              | no       | `3000`      | Port to listen on.                                     |
| `NODE_ENV`                 | no       | —           | `production` suppresses 5xx detail in responses.       |
| `MARLOW_GITHUB_USER_AGENT` | no       | `marlow`    | User agent sent by the Octokit client.                 |
| `MARLOW_GITHUB_BASE_URL`   | no       | —           | GitHub API base URL, e.g. for GitHub Enterprise.       |

### Creating the token

Marlow only reads `MARLOW_GITHUB_TOKEN` and doesn't care what kind of token it
is. Two ways to mint one, each with the permissions pre-filled.

**Fine-grained token — least privilege.** Scoped to a single owner and only the
permissions Marlow actually uses:

**[→ Create a fine-grained token](https://github.com/settings/personal-access-tokens/new?name=Marlow&description=Least-privilege%20access%20to%20allow-listed%20repos&target_name=nrwl&contents=read&issues=write&pull_requests=write&statuses=read)**

The link pre-selects the `nrwl` resource owner and **Contents** (read),
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

| Method | Path                                               | Does                            |
| ------ | -------------------------------------------------- | ------------------------------- |
| GET    | `/openapi.json`                                    | OpenAPI 3.1 description of this API |
| GET    | `/health`                                          | Liveness check                  |
| GET    | `/repos`                                           | List the allow-listed repos     |
| GET    | `/repos/:owner/:repo/permissions`                  | Token's permissions on the repo |
| GET    | `/repos/:owner/:repo/tree?ref=&recursive=`         | List the tree at a ref          |
| GET    | `/repos/:owner/:repo/contents/*?ref=`              | Read a file                     |
| GET    | `/repos/:owner/:repo/search/code?query=`           | Search code, scoped to the repo |
| GET    | `/repos/:owner/:repo/commits?ref=&path=`           | List commits                    |
| GET    | `/repos/:owner/:repo/commits/:sha`                 | A commit with stats and files   |
| GET    | `/repos/:owner/:repo/issues?state=`                | List issues                     |
| GET    | `/repos/:owner/:repo/issues/:issueNumber`          | Get one issue                   |
| POST   | `/repos/:owner/:repo/issues`                       | Create an issue · **confirm**   |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/close`    | Close an issue · **confirm**    |
| GET    | `/repos/:owner/:repo/issues/:issueNumber/comments` | List issue comments             |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/comments` | Comment on an issue · **confirm** |
| PATCH  | `/repos/:owner/:repo/issues/:issueNumber`          | Edit an issue's title/body/state · **confirm** |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/labels`   | Add labels to an issue · **confirm** |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/labels/:name` | Remove a label from an issue · **confirm** |
| POST   | `/repos/:owner/:repo/issues/:issueNumber/assignees` | Add assignees to an issue · **confirm** |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/assignees` | Remove assignees from an issue · **confirm** |
| PUT    | `/repos/:owner/:repo/issues/:issueNumber/milestone` | Set an issue's milestone · **confirm** |
| DELETE | `/repos/:owner/:repo/issues/:issueNumber/milestone` | Clear an issue's milestone · **confirm** |
| GET    | `/repos/:owner/:repo/pulls?state=`                 | List pull requests              |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber`            | Get one pull request            |
| POST   | `/repos/:owner/:repo/pulls`                        | Open a pull request · **confirm** |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/close`      | Close a pull request · **confirm** |
| PATCH  | `/repos/:owner/:repo/pulls/:pullNumber`            | Update a PR's title/body/base · **confirm** |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/files`      | Files changed in a PR           |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/commits`    | Commits in a PR                 |
| GET    | `/repos/:owner/:repo/pulls/:pullNumber/comments`   | Conversation comments on a PR   |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/labels`     | Add labels to a PR · **confirm** |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/labels/:name` | Remove a label from a PR · **confirm** |
| POST   | `/repos/:owner/:repo/pulls/:pullNumber/assignees`  | Add assignees to a PR · **confirm** |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/assignees`  | Remove assignees from a PR · **confirm** |
| PUT    | `/repos/:owner/:repo/pulls/:pullNumber/milestone`  | Set a PR's milestone · **confirm** |
| DELETE | `/repos/:owner/:repo/pulls/:pullNumber/milestone`  | Clear a PR's milestone · **confirm** |
| GET    | `/repos/:owner/:repo/commit-status?ref=`           | Combined commit status          |
| GET    | `/repos/:owner/:repo/check-runs?ref=`              | Check runs for a ref            |

Endpoints marked **confirm** require `{ "confirm": true }` in the request body.

## Built with

| Tool       | Role                                                              |
| ---------- | ---------------------------------------------------------------- |
| Nx         | Monorepo workspace and task runner, on TypeScript project refs.   |
| TypeScript | Strict mode across every library and the app.                    |
| Fastify    | The HTTP server and the composition root.                        |
| Zod        | Request validation at the edge — params, query, and body.        |
| Octokit    | The GitHub client, hidden behind a port and a DTO mapper.        |
| Vitest     | Tests at every layer, including the security boundary itself.     |
| esbuild    | Bundles the app and its source libraries into one runnable file. |

## Development

```sh
pnpm nx run-many -t typecheck test lint   # every project
pnpm nx build marlow-api                   # bundled server
```

Tests cover the security boundary at the domain, application, and HTTP layers.

---

_A narrow door, held open on purpose._
