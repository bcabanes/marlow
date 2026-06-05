import { ApiError, internal, isApiError } from './api-error.js';

/**
 * Coerces an unknown thrown value into an {@link ApiError}.
 *
 * Already-constructed `ApiError`s pass through unchanged; everything else
 * collapses to a generic 500 so unexpected internals are never exposed.
 * Domain- and provider-specific mapping is performed by the API composition
 * root before falling back to this helper.
 */
export const toApiError = (error: unknown): ApiError =>
  isApiError(error) ? error : internal();
