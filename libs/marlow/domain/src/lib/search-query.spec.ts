import { describe, expect, it } from 'vitest';
import { createSearchQuery } from '../index.js';

describe('createSearchQuery', () => {
  it('accepts a plain query', () => {
    expect(createSearchQuery('useEffect cleanup').ok).toBe(true);
  });

  it.each([
    'foo repo:torvalds/linux',
    'foo org:stripe',
    'foo user:octocat',
    'fork:true bar',
    'REPO:Evil/Repo',
  ])('rejects scope-qualifier injection %j', (query) => {
    const result = createSearchQuery(query);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_search_query');
  });

  it('rejects an empty or whitespace-only query', () => {
    expect(createSearchQuery('   ').ok).toBe(false);
  });
});
