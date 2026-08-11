import {
  DomainError,
  Result,
  createAsyncMergeId,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';
import { AsyncMergeResult } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface GetPullRequestMergeResultInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly mergeId: string;
}

export const getPullRequestMergeResult =
  (github: GitHubRepositoryPort) =>
  async (
    input: GetPullRequestMergeResultInput,
  ): Promise<Result<AsyncMergeResult, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const pullNumber = createPullRequestNumber(input.pullNumber);
    if (!pullNumber.ok) return pullNumber;
    const mergeId = createAsyncMergeId(input.mergeId);
    if (!mergeId.ok) return mergeId;
    return ok(
      await github.getPullRequestMergeResult({
        repo: repo.value,
        pullNumber: pullNumber.value,
        mergeId: mergeId.value,
      }),
    );
  };
