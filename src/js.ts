/**
 * doc-mcpify/js - JavaScript Parser Entry Point
 * 
 * Entry point for JavaScript/JSX parsing
 */

export { parseTypeScript, isTypeScriptFile } from './parsers/typescript';
export * from './types';
export { createExpressAdapter } from './server/adapters/express';
export { createFastifyAdapter } from './server/adapters/fastify';
export { default, default as docmcp } from './index';
