import { DomainError, Result, createSearchQuery, ok } from '@org/marlow-domain';
import { CodeSearchResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface SearchCodeInput {
  readonly owner: string;
  readonly repo: string;
  readonly query: string;
  readonly page?: number;
  readonly perPage?: number;
}

export const searchCode =
  (github: GitHubRepositoryPort) =>
  async (
    input: SearchCodeInput,
  ): Promise<Result<CodeSearchResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    // Reject scope qualifiers so the search cannot escape the allowed repo.
    const query = createSearchQuery(input.query);
    if (!query.ok) return query;
    return ok(
      await github.searchCode({
        repo: repo.value,
        query: query.value,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
