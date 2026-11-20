import { DomainError, Result, createCheckRunId, ok } from '@org/marlow-domain';
import { CheckRunRerun } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface RerunCheckRunInput {
  readonly owner: string;
  readonly repo: string;
  readonly checkRunId: number;
}

export const rerunCheckRun =
  (github: GitHubRepositoryPort) =>
  async (
    input: RerunCheckRunInput,
  ): Promise<Result<CheckRunRerun, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const checkRunId = createCheckRunId(input.checkRunId);
    if (!checkRunId.ok) return checkRunId;
    return ok(
      await github.rerunCheckRun({
        repo: repo.value,
        checkRunId: checkRunId.value,
      }),
    );
  };
