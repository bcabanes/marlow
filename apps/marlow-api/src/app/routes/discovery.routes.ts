import { FastifyInstance } from 'fastify';
import { buildCheatSheet } from '../cheatsheet';
import { ROUTE_ALIASES } from '../route-aliases';

/** `GET /` serves the route index; guessed doc and health paths redirect. */
export const registerDiscoveryRoutes = (fastify: FastifyInstance): void => {
  const cheatSheet = buildCheatSheet();
  fastify.get('/', async (_request, reply) =>
    reply.type('text/markdown; charset=utf-8').send(cheatSheet),
  );

  for (const alias of ROUTE_ALIASES) {
    fastify.get(alias.path, async (_request, reply) =>
      reply.redirect(alias.target, 302),
    );
  }
};
