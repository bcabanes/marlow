import { DomainError, Result, ok } from '@org/marlow-domain';
import { Issue } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CreateIssueInput {
  readonly owner: string;
  readonly repo: string;
  readonly title: string;
  readonly body?: string;
  readonly labels?: readonly string[];
}

export const createIssue =
  (github: GitHubRepositoryPort) =>
  async (input: CreateIssueInput): Promise<Result<Issue, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    return ok(
      await github.createIssue({
        repo: repo.value,
        title: input.title,
        body: input.body,
        labels: input.labels,
      }),
    );
  };
