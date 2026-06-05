import { DomainError, Result, createIssueNumber, ok } from '@org/marlow-domain';
import { LabelSet } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface AddLabelsInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly labels: readonly string[];
}

export const addLabels =
  (github: GitHubRepositoryPort) =>
  async (input: AddLabelsInput): Promise<Result<LabelSet, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const issueNumber = createIssueNumber(input.issueNumber);
    if (!issueNumber.ok) return issueNumber;

    return ok(
      await github.addLabels({
        repo: repo.value,
        issueNumber: issueNumber.value,
        labels: input.labels,
      }),
    );
  };
