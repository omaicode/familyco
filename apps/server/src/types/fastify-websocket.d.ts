declare module '@fastify/websocket' {
  import type { FastifyPluginAsync } from 'fastify';

  const websocket: FastifyPluginAsync;
  export default websocket;
}
