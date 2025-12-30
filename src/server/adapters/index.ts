/**
 * doc-mcp - Server Adapters Index
 * 
 * Framework-agnostic adapter interface for mounting MCP routes.
 */

import type { FastifyInstance } from 'fastify';
import type {
  NormalizedSchema,
  ResolvedConfig,
  ServerAdapter,
  ExpressApp,
  Logger,
} from '../../types';
import { createExpressAdapter, createExpressMiddleware } from './express';
import { createFastifyAdapter, createStandaloneFastify, createFastifyPlugin } from './fastify';


// Adapter Factory


/**
 * Detect the server framework type from an app instance
 */
function detectFramework(app: unknown): 'express' | 'fastify' | 'unknown' {
  // Check for Fastify
  if (app && typeof app === 'object' && 'addHook' in app && 'register' in app) {
    return 'fastify';
  }
  
  // Check for Express
  if (app && typeof app === 'object' && 'use' in app && 'get' in app && 'listen' in app) {
    // Fastify also has these, but we checked for Fastify first
    // Check for Express-specific properties
    if ('set' in app && 'engine' in app) {
      return 'express';
    }
    // Default to express-like
    return 'express';
  }
  
  return 'unknown';
}

/**
 * Create an adapter for the given app instance
 */
export function createAdapter(
  app: ExpressApp | FastifyInstance,
  schema: NormalizedSchema,
  config: ResolvedConfig,
  logger: Logger
): ServerAdapter {
  const framework = detectFramework(app);
  
  logger.debug(`Detected framework: ${framework}`);
  
  switch (framework) {
    case 'fastify':
      return createFastifyAdapter(app as FastifyInstance, schema, config, logger);
    
    case 'express':
      return createExpressAdapter(app as ExpressApp, schema, config, logger);
    
    default:
      // Try Express as fallback
      logger.warn('Could not detect framework, attempting Express adapter');
      return createExpressAdapter(app as ExpressApp, schema, config, logger);
  }
}

/**
 * Create a standalone server (not attached to an existing app)
 */
export function createStandaloneServer(
  schema: NormalizedSchema,
  config: ResolvedConfig,
  logger: Logger
): FastifyInstance {
  logger.info('Creating standalone Fastify server');
  return createStandaloneFastify(schema, config, logger);
}

// Re-export specific adapters
export {
  createExpressAdapter,
  createExpressMiddleware,
  createFastifyAdapter,
  createStandaloneFastify,
  createFastifyPlugin,
};
