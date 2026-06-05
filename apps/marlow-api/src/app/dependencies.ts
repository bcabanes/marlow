import { GitHubRepositoryPort } from '@org/marlow-application';
import { createStaticCredentialProvider } from '@org/marlow-infrastructure-credentials';
import {
  createGitHubRepositoryAdapter,
  createOctokit,
} from '@org/marlow-infrastructure-github';
import { AppConfig } from './config';
import { createLazyGitHubPort } from './lazy-github-port';

export interface AppDependencies {
  readonly config: AppConfig;
  /** Lazily resolves a GitHub port, (re)building the client when the token changes. */
  readonly getGitHubPort: () => Promise<GitHubRepositoryPort>;
}

/**
 * Composition root. Wires the static (in-memory) credential provider to the
 * Octokit-backed GitHub adapter. The adapter is built lazily on first use and
 * cached, and rebuilt only if the resolved token ever changes.
 */
export const createDependencies = (config: AppConfig): AppDependencies => {
  const credentials = createStaticCredentialProvider(config.githubToken);

  let cached: { token: string; port: GitHubRepositoryPort } | undefined;

  // Resolves the real adapter, fetching the (cached) token and rebuilding the
  // client only when the token changes.
  const resolvePort = async (): Promise<GitHubRepositoryPort> => {
    const token = await credentials.getToken();
    if (cached === undefined || cached.token !== token) {
      cached = {
        token,
        port: createGitHubRepositoryAdapter(
          createOctokit(token, config.github),
        ),
      };
    }
    return cached.port;
  };

  // The lazy port defers credential lookup until a method is actually called,
  // so use cases can reject disallowed repos before any token is fetched.
  const lazyPort = createLazyGitHubPort(resolvePort);

  return { config, getGitHubPort: async () => lazyPort };
};
