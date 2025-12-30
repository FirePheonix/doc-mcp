/**
 * doc-mcp - Main Entry Point
 * 
 * A framework that allows API providers to expose a fully compliant MCP server
 * without writing MCP-specific code. Install, configure, enable — no protocol
 * knowledge required.
 * 
 * @example
 * ```typescript
 * import docmcp from 'doc-mcp';
 * import express from 'express';
 * 
 * const app = express();
 * 
 * await docmcp(app, {
 *   docs: './openapi.yaml',
 *   basePath: '/mcp'
 * });
 * 
 * app.listen(3000);
 * ```
 * 
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type {
  DocMcpConfig,
  DocMcpInstance,
  ExpressApp,
} from './types';
import { resolveConfig, validateConfig, createLogger } from './core';
import { parseAllDocumentation } from './parsers';
import { normalizeSchema } from './normalizers';
import { createAdapter, createStandaloneServer, createMcpHandlers } from './server';


// Main Function


/**
 * Initialize doc-mcp on an existing Express or Fastify application.
 * 
 * @param app - Express or Fastify application instance
 * @param config - doc-mcp configuration options
 * @returns DocMcpInstance with schema access and reload capability
 * 
 * @example
 * ```typescript
 * // With Express
 * const app = express();
 * const mcp = await docmcp(app, { docs: './openapi.yaml' });
 * 
 * // With Fastify
 * const fastify = Fastify();
 * const mcp = await docmcp(fastify, { docs: './openapi.yaml' });
 * ```
 */
async function docmcp(
  app: ExpressApp | FastifyInstance,
  config: DocMcpConfig
): Promise<DocMcpInstance>;

/**
 * Create a standalone MCP server.
 * 
 * @param config - doc-mcp configuration with standalone: true
 * @returns DocMcpInstance with listen() method
 * 
 * @example
 * ```typescript
 * const mcp = await docmcp({
 *   docs: './openapi.yaml',
 *   standalone: true,
 *   port: 3000
 * });
 * 
 * await mcp.listen();
 * ```
 */
async function docmcp(
  config: DocMcpConfig & { standalone: true; port?: number; host?: string }
): Promise<DocMcpInstance & { listen: () => Promise<void> }>;

/**
 * Main docmcp function implementation
 */
async function docmcp(
  appOrConfig: ExpressApp | FastifyInstance | (DocMcpConfig & { standalone?: true; port?: number; host?: string }),
  maybeConfig?: DocMcpConfig
): Promise<DocMcpInstance | (DocMcpInstance & { listen: () => Promise<void> })> {
  // Determine if standalone mode
  const isStandalone = !maybeConfig && 'docs' in appOrConfig && 'standalone' in appOrConfig;
  
  const config: DocMcpConfig = isStandalone 
    ? appOrConfig as DocMcpConfig 
    : maybeConfig!;
  
  const standaloneConfig = isStandalone 
    ? appOrConfig as { port?: number; host?: string }
    : null;
  
  // Resolve and validate configuration
  const resolvedConfig = resolveConfig(config);
  validateConfig(resolvedConfig);
  
  // Create logger
  const logger = createLogger(resolvedConfig.verbose);
  
  logger.info('Initializing doc-mcp...');
  logger.debug('Configuration:', resolvedConfig);
  
  // Parse documentation
  const parseResult = await parseAllDocumentation(
    resolvedConfig.docs,
    resolvedConfig,
    logger
  );
  
  // Normalize schema
  let schema = normalizeSchema(
    parseResult,
    resolvedConfig,
    resolvedConfig.docs,
    logger
  );
  
  // Create MCP handlers
  let handlers = createMcpHandlers(schema, resolvedConfig);
  
  // Create instance methods
  const instance: DocMcpInstance = {
    getSchema: () => schema,
    getConfig: () => resolvedConfig,
    getHandlers: () => handlers,
    reload: async () => {
      logger.info('Reloading documentation...');
      const newParseResult = await parseAllDocumentation(
        resolvedConfig.docs,
        resolvedConfig,
        logger
      );
      schema = normalizeSchema(
        newParseResult,
        resolvedConfig,
        resolvedConfig.docs,
        logger
      );
      handlers = createMcpHandlers(schema, resolvedConfig);
      logger.info('Documentation reloaded successfully');
    },
  };
  
  if (isStandalone) {
    // Create standalone server
    const server = createStandaloneServer(schema, resolvedConfig, logger);
    
    logger.info(`MCP endpoints available at ${resolvedConfig.basePath}/*`);
    
    return {
      ...instance,
      listen: async () => {
        const port = standaloneConfig?.port || 3000;
        const host = standaloneConfig?.host || '0.0.0.0';
        
        await server.listen({ port, host });
        logger.info(`doc-mcp server listening on http://${host}:${port}`);
      },
    };
  } else {
    // Mount on existing app
    const app = appOrConfig as ExpressApp | FastifyInstance;
    const adapter = createAdapter(app, schema, resolvedConfig, logger);
    adapter.mount(schema, resolvedConfig);
    
    logger.info(`MCP endpoints mounted at ${resolvedConfig.basePath}/*`);
    
    return instance;
  }
}


// Exports


// Default export
export default docmcp;

// Named exports
export { docmcp };

// Re-export types
export type {
  DocMcpConfig,
  DocMcpInstance,
  ResolvedConfig,
  NormalizedSchema,
  McpHandlers,
  ApiMetadata,
  EndpointSchema,
  ParameterSchema,
  ResponseSchema,
  JsonSchema,
  AuthConfig,
  AuthInfo,
  SecurityScheme,
  VisibilityConfig,
  CustomParser,
  ParseResult,
  ExpressApp,
  ServerAdapter,
  McpDescribeResponse,
  McpSchemasResponse,
  McpEndpointsResponse,
  McpAuthResponse,
  Logger,
} from './types';

// Re-export utilities for advanced usage
export { resolveConfig, validateConfig, createDefaultConfig, mergeConfigs } from './core';
export { parseOpenAPI, parseMarkdown, parseAllDocumentation } from './parsers';
export { normalizeSchema } from './normalizers';
export { 
  createMcpHandlers, 
  getMcpRoutes,
  createExpressMiddleware,
  createFastifyPlugin,
} from './server';
