/**
 * doc-mcpify/openapi - OpenAPI Parser Entry Point
 * 
 * Entry point for OpenAPI/Swagger parsing
 */

export { parseOpenAPI, isOpenAPIFile, isOpenAPIContent } from './parsers/openapi';
export * from './types';
export { createExpressAdapter } from './server/adapters/express';
export { createFastifyAdapter } from './server/adapters/fastify';
export { default, default as docmcp } from './index';
