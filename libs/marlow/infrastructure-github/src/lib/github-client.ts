import { Octokit } from 'octokit';

export interface GitHubClientOptions {
  readonly userAgent?: string;
  readonly baseUrl?: string;
}

/** Creates an authenticated Octokit client for a single token. */
export const createOctokit = (
  token: string,
  options: GitHubClientOptions = {},
): Octokit =>
  new Octokit({
    auth: token,
    userAgent: options.userAgent ?? 'marlow',
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
  });
