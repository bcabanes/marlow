import { FastifyInstance } from 'fastify';
import { buildOpenApiDocument } from '../openapi';

export const registerOpenApiRoutes = (fastify: FastifyInstance): void => {
  const document = buildOpenApiDocument();
  fastify.get('/openapi.json', async () => document);
};
