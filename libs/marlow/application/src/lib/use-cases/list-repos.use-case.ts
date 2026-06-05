import { listAllowedRepos } from '@org/marlow-domain';
import { RepoSummary } from '../dtos.js';

/**
 * Lists the repositories Marlow is permitted to broker. This is sourced purely
 * from the domain allow-list and never contacts GitHub.
 */
export const listRepos = (): readonly RepoSummary[] =>
  listAllowedRepos().map((repo) => ({
    owner: repo.owner,
    repo: repo.repo,
    fullName: `${repo.owner}/${repo.repo}`,
  }));
