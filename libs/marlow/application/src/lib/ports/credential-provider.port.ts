/**
 * Supplies the GitHub access token. Implementations are responsible for secure
 * retrieval (e.g. via pass-cli) and must never log or persist the token.
 */
export interface CredentialProviderPort {
  getToken(): Promise<string>;
}
