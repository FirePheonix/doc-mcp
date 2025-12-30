/**
 * doc-mcpify/mdx - MDX Parser Entry Point
 * 
 * Entry point for MDX parsing (includes markdown parser)
 */

export { parseMarkdown, isMarkdownFile } from './parsers/markdown';
export * from './types';
export { createExpressAdapter } from './server/adapters/express';
export { createFastifyAdapter } from './server/adapters/fastify';
export { default, default as docmcp } from './index';
