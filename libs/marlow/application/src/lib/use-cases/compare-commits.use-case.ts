import {
  DomainError,
  Result,
  createCompareRange,
  ok,
} from '@org/marlow-domain';
import { CommitComparison } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CompareCommitsInput {
  readonly owner: string;
  readonly repo: string;
  /** `BASE...HEAD`. */
  readonly basehead: string;
  readonly page?: number;
  readonly perPage?: number;
}

export const compareCommits =
  (github: GitHubRepositoryPort) =>
  async (
    input: CompareCommitsInput,
  ): Promise<Result<CommitComparison, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const range = createCompareRange(input.basehead);
    if (!range.ok) return range;
    return ok(
      await github.compareCommits({
        repo: repo.value,
        range: range.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
