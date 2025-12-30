/**
 * doc-mcp - Server Module Exports
 */

export { createMcpHandlers, getMcpRoutes } from './router';
export { 
  createAdapter, 
  createStandaloneServer,
  createExpressAdapter,
  createExpressMiddleware,
  createFastifyAdapter,
  createStandaloneFastify,
  createFastifyPlugin,
} from './adapters';
