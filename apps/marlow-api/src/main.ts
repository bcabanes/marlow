import Fastify from 'fastify';
import { app } from './app/app';
import { loadConfig } from './app/config';
import { createDependencies } from './app/dependencies';

const config = loadConfig();
const deps = createDependencies(config);

const server = Fastify({
  logger: true,
});

server.register(app, { deps });

server.listen({ port: config.port, host: config.host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    server.log.info(`Marlow API ready at http://${config.host}:${config.port}`);
  }
});
