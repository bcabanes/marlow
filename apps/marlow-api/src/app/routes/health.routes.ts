import { FastifyInstance } from 'fastify';

export const registerHealthRoutes = (fastify: FastifyInstance): void => {
  fastify.get('/health', async () => ({ status: 'ok' }));
};
