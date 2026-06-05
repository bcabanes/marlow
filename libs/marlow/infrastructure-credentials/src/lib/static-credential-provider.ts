import { CredentialProviderPort } from '@org/marlow-application';

/** A credential failure stripped of any potentially sensitive detail. */
export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

/**
 * Supplies a GitHub token the operator has already resolved — typically read
 * from an environment variable populated however they prefer (pass-cli,
 * 1Password, Vault, a CI secret, …).
 *
 * Marlow never fetches the secret itself and is deliberately agnostic about its
 * source; it only ever holds the provided value in memory.
 */
export const createStaticCredentialProvider = (
  token: string,
): CredentialProviderPort => {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new CredentialError('A GitHub token must be provided');
  }
  return {
    getToken: async (): Promise<string> => trimmed,
  };
};
