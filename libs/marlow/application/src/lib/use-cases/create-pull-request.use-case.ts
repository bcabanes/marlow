import { DomainError, Result, createGitRef, ok } from '@org/marlow-domain';
import { PullRequest } from '../dtos.js';
import { GitHubRepositoryPort } from '../ports/github-repository.port.js';
import { resolveAllowedRepo } from '../resolve-allowed-repo.js';

export interface CreatePullRequestInput {
  readonly owner: string;
  readonly repo: string;
  readonly title: string;
  readonly head: string;
  readonly base: string;
  readonly body?: string;
  readonly draft?: boolean;
}

export const createPullRequest =
  (github: GitHubRepositoryPort) =>
  async (
    input: CreatePullRequestInput,
  ): Promise<Result<PullRequest, DomainError>> => {
    const repo = resolveAllowedRepo(input.owner, input.repo);
    if (!repo.ok) return repo;
    const head = createGitRef(input.head);
    if (!head.ok) return head;
    const base = createGitRef(input.base);
    if (!base.ok) return base;
    return ok(
      await github.createPullRequest({
        repo: repo.value,
        title: input.title,
        head: head.value,
        base: base.value,
        body: input.body,
        draft: input.draft,
      }),
    );
  };
