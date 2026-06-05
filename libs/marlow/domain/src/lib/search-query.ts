import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import { Result, err, ok } from './result.js';

/** A validated code-search query, free of repository-scoping qualifiers. */
export type SearchQuery = string & { readonly __brand: 'SearchQuery' };

// GitHub code search ORs scope qualifiers together, so a user-supplied `repo:`,
// `org:`, `user:`, or `fork:` qualifier would broaden the search beyond the
// allow-listed repository (an allow-list bypass). Marlow scopes the search to
// the allowed repo itself, so these qualifiers must be rejected outright.
const SCOPE_QUALIFIER = /(^|\s)(repo|org|user|fork):/i;

export const createSearchQuery = (
  value: string,
): Result<SearchQuery, DomainError> => {
  if (value.trim().length === 0) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidSearchQuery,
        'Search query must not be empty',
      ),
    );
  }
  if (SCOPE_QUALIFIER.test(value)) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidSearchQuery,
        'Search query must not contain repo:, org:, user:, or fork: qualifiers',
      ),
    );
  }
  return ok(value as SearchQuery);
};
