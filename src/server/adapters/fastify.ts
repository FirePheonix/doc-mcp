/**
 * doc-mcp - Fastify Adapter
 * 
 * Mounts MCP routes on an existing Fastify application or creates a standalone server.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { 
  NormalizedSchema, 
  ResolvedConfig, 
  ServerAdapter,
  McpHandlers,
  Logger,
} from '../../types';
import { createMcpHandlers, getMcpRoutes } from '../router';


// Fastify Adapter


/**
 * Create a Fastify adapter for MCP routes
 */
export function createFastifyAdapter(
  fastify: FastifyInstance,
  schema: NormalizedSchema,
  config: ResolvedConfig,
  logger: Logger
): ServerAdapter {
  const handlers = createMcpHandlers(schema, config);
  const routes = getMcpRoutes(config.basePath);
  
  // Mount routes on the Fastify instance
  mountFastifyRoutes(fastify, handlers, routes, logger);
  
  return {
    type: 'fastify',
    mount: () => {
      // Already mounted during creation
      logger.info(`MCP routes mounted at ${config.basePath}`);
    },
    getServer: () => fastify,
  };
}

/**
 * Create a standalone Fastify server with MCP routes
 */
export function createStandaloneFastify(
  schema: NormalizedSchema,
  config: ResolvedConfig,
  logger: Logger
): FastifyInstance {
  const fastify = Fastify({
    logger: config.verbose,
  });
  
  const handlers = createMcpHandlers(schema, config);
  const routes = getMcpRoutes(config.basePath);
  
  // Mount routes
  mountFastifyRoutes(fastify, handlers, routes, logger);
  
  // Add root route with MCP info
  fastify.get('/', async () => {
    return {
      name: 'doc-mcp',
      version: '1.0.0',
      description: 'MCP Server for API Documentation',
      endpoints: routes.map(r => ({
        method: r.method,
        path: r.path,
        description: r.description,
      })),
    };
  });
  
  return fastify;
}

/**
 * Mount MCP routes on a Fastify instance
 */
function mountFastifyRoutes(
  fastify: FastifyInstance,
  handlers: McpHandlers,
  routes: ReturnType<typeof getMcpRoutes>,
  logger: Logger
): void {
  for (const route of routes) {
    const handler = createFastifyHandler(handlers[route.handler], route.handler);
    
    fastify.get(route.path, {
      schema: {
        description: route.description,
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    }, handler);
    
    logger.debug(`Mounted Fastify route: ${route.method} ${route.path}`);
  }
}

/**
 * Create a Fastify handler from an MCP handler
 */
function createFastifyHandler(
  handler: McpHandlers[keyof McpHandlers],
  handlerName: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.header('Content-Type', 'application/json');
      
      // Handle endpoints query parameters
      if (handlerName === 'endpoints') {
        const query = request.query as Record<string, string | undefined>;
        const result = (handler as McpHandlers['endpoints'])({
          tag: query.tag,
          method: query.method,
          path: query.path,
          deprecated: query.deprecated === 'true' ? true : query.deprecated === 'false' ? false : undefined,
        });
        return result;
      } else {
        // Other handlers don't take parameters
        return (handler as () => unknown)();
      }
    } catch (error) {
      reply.status(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

/**
 * Create a Fastify plugin for MCP routes
 * Alternative to directly mounting routes
 */
export function createFastifyPlugin(
  schema: NormalizedSchema,
  config: ResolvedConfig
) {
  return async function mcpPlugin(fastify: FastifyInstance) {
    const handlers = createMcpHandlers(schema, config);
    const routes = getMcpRoutes(config.basePath);
    
    for (const route of routes) {
      const handler = createFastifyHandler(handlers[route.handler], route.handler);
      fastify.get(route.path, handler);
    }
  };
}
