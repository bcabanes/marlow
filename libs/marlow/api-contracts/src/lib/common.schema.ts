import { z } from 'zod';

/** Path parameters identifying a repository: `/repos/:owner/:repo`. */
export const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});
export type RepoParams = z.infer<typeof repoParamsSchema>;

/** Shared pagination query parameters (coerced from query strings). */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Required confirmation envelope for every state-changing (write) endpoint.
 * Clients must send `{ "confirm": true }` or the request is rejected.
 */
export const confirmBodySchema = z.object({
  confirm: z.literal(true),
});
export type ConfirmBody = z.infer<typeof confirmBodySchema>;
