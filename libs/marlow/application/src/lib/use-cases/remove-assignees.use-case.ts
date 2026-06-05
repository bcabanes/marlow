import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { AssigneeSet } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface RemoveAssigneesInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly assignees: readonly string[];
}

export const removeAssignees =
  (github: GitHubRepositoryPort) =>
  async (
    input: RemoveAssigneesInput,
  ): Promise<Result<AssigneeSet, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;

    return ok(
      await github.removeAssignees({
        repo: repo.value,
        issueNumber: issueNumber.value,
        assignees: input.assignees,
      }),
    );
  };
