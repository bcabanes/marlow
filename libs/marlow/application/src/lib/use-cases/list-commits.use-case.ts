import {
  DomainError,
  FilePath,
  GitRef,
  Result,
  createFilePath,
  createGitRef,
  ok,
} from '@org/marlow-domain';
import { CommitSummary } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface ListCommitsInput {
  readonly owner: string;
  readonly repo: string;
  readonly ref?: string;
  readonly path?: string;
  readonly page?: number;
  readonly perPage?: number;
}

export const listCommits =
  (github: GitHubRepositoryPort) =>
  async (
    input: ListCommitsInput,
  ): Promise<Result<readonly CommitSummary[], DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    let ref: GitRef | undefined;
    if (input.ref !== undefined) {
      const parsedRef = createGitRef(input.ref);
      if (!parsedRef.ok) return parsedRef;
      ref = parsedRef.value;
    }
    let path: FilePath | undefined;
    if (input.path !== undefined) {
      const parsedPath = createFilePath(input.path);
      if (!parsedPath.ok) return parsedPath;
      path = parsedPath.value;
    }
    return ok(
      await github.listCommits({
        repo: repo.value,
        ref,
        path,
        page: input.page,
        perPage: input.perPage,
      }),
    );
  };
