/**
 * Stable, transport-facing error codes returned by the Marlow API. These are
 * part of the public contract and should not be renamed casually.
 */
export const API_ERROR_CODES = {
  BadRequest: 'bad_request',
  ValidationFailed: 'validation_failed',
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  RepoNotAllowed: 'repo_not_allowed',
  NotFound: 'not_found',
  Conflict: 'conflict',
  RateLimited: 'rate_limited',
  UpstreamUnavailable: 'upstream_unavailable',
  Internal: 'internal_error',
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorOptions {
  readonly details?: unknown;
  readonly cause?: unknown;
}

/** A transport error carrying an HTTP status, a stable code, and a safe message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

export const badRequest = (message: string, details?: unknown): ApiError =>
  new ApiError(400, API_ERROR_CODES.BadRequest, message, { details });

export const validationFailed = (
  message: string,
  details?: unknown,
): ApiError =>
  new ApiError(400, API_ERROR_CODES.ValidationFailed, message, { details });

export const unauthorized = (message = 'Unauthorized'): ApiError =>
  new ApiError(401, API_ERROR_CODES.Unauthorized, message);

export const forbidden = (message = 'Forbidden'): ApiError =>
  new ApiError(403, API_ERROR_CODES.Forbidden, message);

export const repoNotAllowed = (message: string): ApiError =>
  new ApiError(403, API_ERROR_CODES.RepoNotAllowed, message);

export const notFound = (message = 'Not found'): ApiError =>
  new ApiError(404, API_ERROR_CODES.NotFound, message);

export const conflict = (message: string): ApiError =>
  new ApiError(409, API_ERROR_CODES.Conflict, message);

export const rateLimited = (message = 'Rate limited'): ApiError =>
  new ApiError(429, API_ERROR_CODES.RateLimited, message);

export const upstreamUnavailable = (
  message = 'Upstream service unavailable',
): ApiError => new ApiError(502, API_ERROR_CODES.UpstreamUnavailable, message);

export const internal = (message = 'Internal server error'): ApiError =>
  new ApiError(500, API_ERROR_CODES.Internal, message);
