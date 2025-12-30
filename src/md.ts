/**
 * doc-mcpify/md - Markdown Parser Entry Point
 * 
 * Lightweight entry point for markdown-only parsing
 */

export { parseMarkdown, isMarkdownFile } from './parsers/markdown';
export * from './types';
export { createExpressAdapter } from './server/adapters/express';
export { createFastifyAdapter } from './server/adapters/fastify';
export { default, default as docmcp } from './index';
