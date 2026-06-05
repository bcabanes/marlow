import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { Issue, IssueStateReason } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface UpdateIssueInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly title?: string;
  readonly body?: string;
  readonly state?: 'open' | 'closed';
  readonly stateReason?: IssueStateReason;
}

export const updateIssue =
  (github: GitHubRepositoryPort) =>
  async (input: UpdateIssueInput): Promise<Result<Issue, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;

    return ok(
      await github.updateIssue({
        repo: repo.value,
        issueNumber: issueNumber.value,
        title: input.title,
        body: input.body,
        state: input.state,
        stateReason: input.stateReason,
      }),
    );
  };
