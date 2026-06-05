import { DomainError, Result, createGitSha, ok } from '@org/marlow-domain';
import { CommitDetail } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetCommitInput {
  readonly owner: string;
  readonly repo: string;
  readonly sha: string;
}

export const getCommit =
  (github: GitHubRepositoryPort) =>
  async (input: GetCommitInput): Promise<Result<CommitDetail, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const sha = createGitSha(input.sha);
    if (!sha.ok) return sha;
    return ok(await github.getCommit({ repo: repo.value, sha: sha.value }));
  };
