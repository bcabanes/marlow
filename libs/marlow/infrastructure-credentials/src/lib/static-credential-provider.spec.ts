import { describe, expect, it } from 'vitest';
import { CredentialError, createStaticCredentialProvider } from '../index.js';

describe('createStaticCredentialProvider', () => {
  it('returns the provided token, trimmed', async () => {
    const provider = createStaticCredentialProvider('  ghp_secret\n');
    expect(await provider.getToken()).toBe('ghp_secret');
  });

  it('rejects an empty token at construction', () => {
    expect(() => createStaticCredentialProvider('   ')).toThrow(
      CredentialError,
    );
  });
});
