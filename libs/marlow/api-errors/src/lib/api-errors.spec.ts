import { describe, expect, it } from 'vitest';
import {
  ApiError,
  badRequest,
  internal,
  isApiError,
  notFound,
  toApiError,
  toErrorResponse,
} from '../index.js';

describe('ApiError factories', () => {
  it('build errors with the right status and code', () => {
    expect(badRequest('nope').status).toBe(400);
    expect(notFound().code).toBe('not_found');
    expect(isApiError(internal())).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });
});

describe('toErrorResponse', () => {
  it('suppresses 5xx messages and details by default', () => {
    const error = new ApiError(500, 'internal_error', 'db exploded', {
      details: { secret: true },
    });
    expect(toErrorResponse(error)).toEqual({
      error: { code: 'internal_error', message: 'Internal server error' },
    });
  });

  it('exposes details only when explicitly allowed', () => {
    const error = badRequest('bad input', { field: 'ref' });
    expect(toErrorResponse(error, { exposeInternals: true })).toEqual({
      error: {
        code: 'bad_request',
        message: 'bad input',
        details: { field: 'ref' },
      },
    });
  });

  it('keeps 4xx messages even in production mode', () => {
    expect(toErrorResponse(notFound('no such issue'))).toEqual({
      error: { code: 'not_found', message: 'no such issue' },
    });
  });
});

describe('toApiError', () => {
  it('passes ApiError through and collapses unknowns to 500', () => {
    const api = badRequest('x');
    expect(toApiError(api)).toBe(api);
    const fallback = toApiError(new Error('boom'));
    expect(fallback.status).toBe(500);
    expect(fallback.code).toBe('internal_error');
  });
});
