import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { IssueComment } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CreateIssueCommentInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly body: string;
}

export const createIssueComment =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreateIssueCommentInput,
  ): Promise<Result<IssueComment, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;
    return ok(
      await github.createIssueComment({
        repo: repo.value,
        issueNumber: issueNumber.value,
        body: input.body,
      }),
    );
  };
