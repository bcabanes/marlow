import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { Issue } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetIssueInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
}

export const getIssue =
  (github: GitHubRepositoryPort) =>
  async (input: GetIssueInput): Promise<Result<Issue, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;
    return ok(
      await github.getIssue({
        repo: repo.value,
        issueNumber: issueNumber.value,
      }),
    );
  };
