import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { MilestoneResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ClearMilestoneInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
}

export const clearMilestone =
  (github: GitHubRepositoryPort) =>
  async (
    input: ClearMilestoneInput,
  ): Promise<Result<MilestoneResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;

    return ok(
      await github.clearMilestone({
        repo: repo.value,
        issueNumber: issueNumber.value,
      }),
    );
  };
