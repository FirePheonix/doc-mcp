/**
 * doc-mcp - Express Adapter
 * 
 * Mounts MCP routes on an existing Express application.
 */

import type { 
  NormalizedSchema, 
  ResolvedConfig, 
  ServerAdapter,
  ExpressApp,
  McpHandlers,
  Logger,
} from '../../types';
import { createMcpHandlers, getMcpRoutes } from '../router';

// Express types (loose to avoid dependency)
interface ExpressRequest {
  query: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  path: string;
  method: string;
}

interface ExpressResponse {
  json: (data: unknown) => void;
  status: (code: number) => ExpressResponse;
  setHeader: (name: string, value: string) => void;
}

type ExpressNextFunction = (err?: unknown) => void;
type ExpressHandler = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void;


// Express Adapter


/**
 * Create an Express adapter for MCP routes
 */
export function createExpressAdapter(
  app: ExpressApp,
  schema: NormalizedSchema,
  config: ResolvedConfig,
  logger: Logger
): ServerAdapter {
  const handlers = createMcpHandlers(schema, config);
  const routes = getMcpRoutes(config.basePath);
  
  // Mount routes on the Express app
  mountExpressRoutes(app, handlers, routes, logger);
  
  return {
    type: 'express',
    mount: () => {
      // Already mounted during creation
      logger.info(`MCP routes mounted at ${config.basePath}`);
    },
    getServer: () => app,
  };
}

/**
 * Mount MCP routes on an Express app
 */
function mountExpressRoutes(
  app: ExpressApp,
  handlers: McpHandlers,
  routes: ReturnType<typeof getMcpRoutes>,
  logger: Logger
): void {
  for (const route of routes) {
    const handler = createExpressHandler(handlers[route.handler], route.handler);
    
    // Use app.get for GET routes
    (app.get as (path: string, handler: ExpressHandler) => void)(route.path, handler);
    
    logger.debug(`Mounted Express route: ${route.method} ${route.path}`);
  }
}

/**
 * Create an Express handler from an MCP handler
 */
function createExpressHandler(
  handler: McpHandlers[keyof McpHandlers],
  handlerName: string
): ExpressHandler {
  return (req: ExpressRequest, res: ExpressResponse) => {
    try {
      // Set JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      // Handle endpoints query parameters
      if (handlerName === 'endpoints') {
        const query = {
          tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
          method: typeof req.query.method === 'string' ? req.query.method : undefined,
          path: typeof req.query.path === 'string' ? req.query.path : undefined,
          deprecated: req.query.deprecated === 'true' ? true : req.query.deprecated === 'false' ? false : undefined,
        };
        const result = (handler as McpHandlers['endpoints'])(query);
        res.json(result);
      } else {
        // Other handlers don't take parameters
        const result = (handler as () => unknown)();
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * Create Express middleware for MCP routes
 * Alternative to directly mounting routes
 */
export function createExpressMiddleware(
  schema: NormalizedSchema,
  config: ResolvedConfig
): ExpressHandler {
  const handlers = createMcpHandlers(schema, config);
  const routes = getMcpRoutes(config.basePath);
  
  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    // Check if this request matches an MCP route
    const matchedRoute = routes.find(
      route => route.method === req.method && req.path === route.path
    );
    
    if (!matchedRoute) {
      return next();
    }
    
    // Handle the request
    const handler = createExpressHandler(handlers[matchedRoute.handler], matchedRoute.handler);
    handler(req, res, next);
  };
}
