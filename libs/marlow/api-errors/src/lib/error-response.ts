import { ApiError } from './api-error.js';

/** The JSON body shape Marlow returns for every error response. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

export interface ToErrorResponseOptions {
  /**
   * When false (the production default), server-side (5xx) error messages and
   * all `internal` details are suppressed so internal information never leaks
   * to clients. `public` details on a 4xx error are always returned.
   */
  readonly exposeInternals: boolean;
}

export const toErrorResponse = (
  error: ApiError,
  options: ToErrorResponseOptions = { exposeInternals: false },
): ApiErrorBody => {
  const isServerError = error.status >= 500;
  const message =
    isServerError && !options.exposeInternals
      ? 'Internal server error'
      : error.message;

  const showDetails =
    error.details !== undefined &&
    (options.exposeInternals ||
      (error.detailsVisibility === 'public' && !isServerError));
  if (showDetails) {
    return { error: { code: error.code, message, details: error.details } };
  }
  return { error: { code: error.code, message } };
};
