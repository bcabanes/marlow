import { isGitHubPortError } from '@org/marlow-application';
import {
  ApiError,
  isApiError,
  toApiError,
  toErrorResponse,
  validationFailed,
} from '@org/marlow-api-errors';
import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppDependencies } from './dependencies';
import { githubErrorToApiError } from './error-mapping';

const resolveApiError = (error: unknown): ApiError => {
  if (isApiError(error)) return error;
  if (error instanceof ZodError) {
    return validationFailed('Request validation failed', error.issues);
  }
  if (isGitHubPortError(error)) return githubErrorToApiError(error);
  return toApiError(error);
};

/** Centralized error handler: every thrown error becomes a safe ApiError body. */
export const registerErrorHandler = (
  fastify: FastifyInstance,
  deps: AppDependencies,
): void => {
  fastify.setErrorHandler((error, request, reply) => {
    const apiError = resolveApiError(error);
    if (apiError.status >= 500) {
      request.log.error({ err: error }, 'Unhandled request error');
    }
    return reply.status(apiError.status).send(
      toErrorResponse(apiError, {
        exposeInternals: deps.config.exposeInternalErrors,
      }),
    );
  });
};
