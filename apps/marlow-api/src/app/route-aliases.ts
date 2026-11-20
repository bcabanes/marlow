/**
 * Paths agents guess when they look for Marlow's docs or health check. Each
 * answers with a 302 to the real route. `discovery.routes.ts` registers them
 * and `openapi.ts` documents them from this one table.
 */
export const ROUTE_ALIASES = [
  { path: '/docs', target: '/', operationId: 'redirectDocsToIndex' },
  { path: '/help', target: '/', operationId: 'redirectHelpToIndex' },
  { path: '/routes', target: '/', operationId: 'redirectRoutesToIndex' },
  { path: '/api', target: '/', operationId: 'redirectApiToIndex' },
  {
    path: '/healthz',
    target: '/health',
    operationId: 'redirectHealthzToHealth',
  },
] as const;
