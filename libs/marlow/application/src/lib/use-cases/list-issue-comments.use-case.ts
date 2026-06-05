import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { IssueComment } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListIssueCommentsInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly page?: number;
  readonly perPage?: number;
}

export const listIssueComments =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListIssueCommentsInput,
  ): Promise<Result<readonly IssueComment[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;
    return ok(
      await github.listIssueComments({
        repo: repo.value,
        issueNumber: issueNumber.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
