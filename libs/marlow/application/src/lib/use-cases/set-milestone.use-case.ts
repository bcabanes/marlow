import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { MilestoneResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface SetMilestoneInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly milestone: number;
}

export const setMilestone =
  (github: GitHubRepositoryPort) =>
  async (
    input: SetMilestoneInput,
  ): Promise<Result<MilestoneResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;

    return ok(
      await github.setMilestone({
        repo: repo.value,
        issueNumber: issueNumber.value,
        milestone: input.milestone,
      }),
    );
  };
