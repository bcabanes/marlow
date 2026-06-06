# Marlow API cheat-sheet

Local GitHub broker — least-privilege access to an allow-listed set of private
repositories. JSON only; writes require `{ "confirm": true }` in the body. This
is a generated summary; GET /openapi.json for the full request/response schema.

Format: `METHOD path [?query] [body{...}] -> ReturnType`; a `?` suffix marks an
optional field. List endpoints return trimmed `*Summary`/`*ListItem` rows with
no body — fetch a single resource for the full body.

## meta
GET /openapi.json -> OpenAPI 3.1 document
GET /health -> { "status": "ok" }

## repositories
GET /repos -> Repository[]
GET /repos/{owner}/{repo}/permissions -> PermissionCheck

## contents
GET /repos/{owner}/{repo}/tree ?ref,recursive -> TreeResult
GET /repos/{owner}/{repo}/contents/{path} ?ref -> FileContents
GET /repos/{owner}/{repo}/search/code ?query,page,perPage -> CodeSearchResult

## commits
GET /repos/{owner}/{repo}/commits ?ref,path,page,perPage -> CommitListItem[]
GET /repos/{owner}/{repo}/commits/{sha} -> CommitDetail

## issues
GET /repos/{owner}/{repo}/issues ?state,page,perPage -> IssueSummary[]
GET /repos/{owner}/{repo}/issues/{issueNumber} -> Issue
POST /repos/{owner}/{repo}/issues body{confirm,title,body?,labels?} -> Issue
POST /repos/{owner}/{repo}/issues/{issueNumber}/close body{confirm} -> Issue
GET /repos/{owner}/{repo}/issues/{issueNumber}/comments ?page,perPage -> IssueComment[]
POST /repos/{owner}/{repo}/issues/{issueNumber}/comments body{confirm,body} -> IssueComment
PATCH /repos/{owner}/{repo}/issues/{issueNumber} body{confirm,title?,body?,state?,stateReason?} -> Issue
POST /repos/{owner}/{repo}/issues/{issueNumber}/labels body{confirm,labels} -> LabelSet
DELETE /repos/{owner}/{repo}/issues/{issueNumber}/labels/{name} body{confirm} -> LabelSet
POST /repos/{owner}/{repo}/issues/{issueNumber}/assignees body{confirm,assignees} -> AssigneeSet
DELETE /repos/{owner}/{repo}/issues/{issueNumber}/assignees body{confirm,assignees} -> AssigneeSet
PUT /repos/{owner}/{repo}/issues/{issueNumber}/milestone body{confirm,milestone} -> MilestoneResult
DELETE /repos/{owner}/{repo}/issues/{issueNumber}/milestone body{confirm} -> MilestoneResult

## pulls
GET /repos/{owner}/{repo}/pulls ?state,page,perPage -> PullRequestSummary[]
GET /repos/{owner}/{repo}/pulls/{pullNumber} -> PullRequest
POST /repos/{owner}/{repo}/pulls body{confirm,title,head,base,body?,draft?} -> PullRequest
POST /repos/{owner}/{repo}/pulls/{pullNumber}/close body{confirm} -> PullRequest
PATCH /repos/{owner}/{repo}/pulls/{pullNumber} body{confirm,title?,body?,base?} -> PullRequest
GET /repos/{owner}/{repo}/pulls/{pullNumber}/files ?page,perPage -> PullRequestFile[]
GET /repos/{owner}/{repo}/pulls/{pullNumber}/commits ?page,perPage -> CommitListItem[]
GET /repos/{owner}/{repo}/pulls/{pullNumber}/comments ?page,perPage -> IssueComment[]
POST /repos/{owner}/{repo}/pulls/{pullNumber}/labels body{confirm,labels} -> LabelSet
DELETE /repos/{owner}/{repo}/pulls/{pullNumber}/labels/{name} body{confirm} -> LabelSet
POST /repos/{owner}/{repo}/pulls/{pullNumber}/assignees body{confirm,assignees} -> AssigneeSet
DELETE /repos/{owner}/{repo}/pulls/{pullNumber}/assignees body{confirm,assignees} -> AssigneeSet
PUT /repos/{owner}/{repo}/pulls/{pullNumber}/milestone body{confirm,milestone} -> MilestoneResult
DELETE /repos/{owner}/{repo}/pulls/{pullNumber}/milestone body{confirm} -> MilestoneResult

## statuses
GET /repos/{owner}/{repo}/commit-status ?ref -> CombinedStatus

## checks
GET /repos/{owner}/{repo}/check-runs ?ref -> CheckRun[]
