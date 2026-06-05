import { describe, expect, it } from 'vitest';
import {
  ALLOWED_REPOS,
  assertRepoAllowed,
  createFilePath,
  createGitRef,
  createGitSha,
  createIssueNumber,
  createPullRequestNumber,
  createRepoRef,
  isRepoAllowed,
  repoRefToString,
} from '../index.js';

const unwrap = <T>(result: { ok: boolean; value?: T }): T => {
  if (!result.ok) throw new Error('expected ok result');
  return result.value as T;
};

describe('createRepoRef', () => {
  it('accepts a well-formed owner/repo', () => {
    const result = createRepoRef('nrwl', 'nx');
    expect(result.ok).toBe(true);
    expect(repoRefToString(unwrap(result))).toBe('nrwl/nx');
  });

  it.each([
    ['-bad', 'nx', 'leading hyphen owner'],
    ['nrwl', '..', 'reserved repo name'],
    ['has space', 'nx', 'space in owner'],
    ['nrwl', 'has/slash', 'slash in repo'],
  ])('rejects %s/%s (%s)', (owner, repo) => {
    const result = createRepoRef(owner, repo);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_repo_ref');
  });
});

describe('allow-list (security boundary)', () => {
  it('exposes exactly the two permitted repositories', () => {
    expect(ALLOWED_REPOS.map((r) => `${r.owner}/${r.repo}`)).toEqual([
      'nrwl/ocean',
      'nrwl/nx',
    ]);
  });

  it('allows permitted repos case-insensitively', () => {
    expect(isRepoAllowed(unwrap(createRepoRef('NRWL', 'Nx')))).toBe(true);
    expect(isRepoAllowed(unwrap(createRepoRef('nrwl', 'ocean')))).toBe(true);
  });

  it('rejects repositories that are not on the list', () => {
    const ref = unwrap(createRepoRef('nrwl', 'secret-repo'));
    expect(isRepoAllowed(ref)).toBe(false);
    const asserted = assertRepoAllowed(ref);
    expect(asserted.ok).toBe(false);
    if (!asserted.ok) expect(asserted.error.code).toBe('repo_not_allowed');
  });
});

describe('git primitives', () => {
  it('accepts valid refs and shas', () => {
    expect(createGitRef('main').ok).toBe(true);
    expect(createGitRef('release/1.x').ok).toBe(true);
    expect(createGitSha('a'.repeat(40)).ok).toBe(true);
    expect(createGitSha('abc1234').ok).toBe(true);
  });

  it.each(['', '..', 'feature branch', 'bad~ref', '/leading', 'trailing.lock'])(
    'rejects invalid git ref %j',
    (value) => {
      expect(createGitRef(value).ok).toBe(false);
    },
  );

  it.each(['', 'xyz', 'abc', 'g'.repeat(40)])(
    'rejects invalid sha %j',
    (value) => {
      expect(createGitSha(value).ok).toBe(false);
    },
  );
});

describe('file paths', () => {
  it('accepts repo-relative paths', () => {
    expect(createFilePath('src/index.ts').ok).toBe(true);
  });

  it.each(['', '/etc/passwd', '../secrets', 'a/../b', 'a//b', 'a\\b'])(
    'rejects traversal or malformed path %j',
    (value) => {
      expect(createFilePath(value).ok).toBe(false);
    },
  );
});

describe('issue and pull request numbers', () => {
  it('accepts positive integers', () => {
    expect(createIssueNumber(1).ok).toBe(true);
    expect(createPullRequestNumber(42).ok).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects %j', (value) => {
    expect(createIssueNumber(value).ok).toBe(false);
    expect(createPullRequestNumber(value).ok).toBe(false);
  });
});
