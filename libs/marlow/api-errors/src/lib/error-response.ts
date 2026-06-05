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
   * all `details` are suppressed so internal information never leaks to clients.
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

  if (options.exposeInternals && error.details !== undefined) {
    return { error: { code: error.code, message, details: error.details } };
  }
  return { error: { code: error.code, message } };
};
