import {
  DomainError,
  GitRef,
  Result,
  createFilePath,
  createGitRef,
  ok,
} from '@org/marlow-domain';
import { FileContents } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetFileContentsInput {
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly ref?: string;
}

export const getFileContents =
  (github: GitHubRepositoryPort) =>
  async (
    input: GetFileContentsInput,
  ): Promise<Result<FileContents, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const path = createFilePath(input.path);
    if (!path.ok) return path;
    let ref: GitRef | undefined;
    if (input.ref !== undefined) {
      const parsedRef = createGitRef(input.ref);
      if (!parsedRef.ok) return parsedRef;
      ref = parsedRef.value;
    }
    return ok(
      await github.getFileContents({ repo: repo.value, path: path.value, ref }),
    );
  };
