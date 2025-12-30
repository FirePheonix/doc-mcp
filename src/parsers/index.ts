/**
 * doc-mcp - Parser Index
 * 
 * Unified parser interface that handles multiple documentation formats.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { parseOpenAPI, isOpenAPIFile, isOpenAPIContent } from './openapi';
import { parseMarkdown, isMarkdownFile } from './markdown';
import { parseTypeScript, isTypeScriptFile } from './typescript';
import type { ParseResult, ResolvedConfig, CustomParser, Logger } from '../types';


// Main Parser Interface


/**
 * Parse documentation from a file path or URL
 */
export async function parseDocumentation(
  source: string,
  config: ResolvedConfig,
  logger: Logger
): Promise<ParseResult> {
  logger.debug(`Parsing documentation source: ${source}`);
  
  // Check if source is a glob pattern
  if (isGlobPattern(source)) {
    return parseGlobPattern(source, config, logger);
  }
  
  // Check custom parsers first
  for (const parser of config.parsers) {
    if (matchesParser(source, parser)) {
      logger.debug(`Using custom parser for: ${source}`);
      const content = await readSource(source);
      return parser.parse(content, source);
    }
  }
  
  // Determine parser based on file extension or content
  if (isURL(source)) {
    return parseFromURL(source, config, logger);
  }
  
  return parseFromFile(source, config, logger);
}

/**
 * Parse multiple documentation sources and merge results
 */
export async function parseAllDocumentation(
  sources: string[],
  config: ResolvedConfig,
  logger: Logger
): Promise<ParseResult> {
  const results: ParseResult[] = [];
  
  for (const source of sources) {
    try {
      const result = await parseDocumentation(source, config, logger);
      results.push(result);
      logger.debug(`Successfully parsed: ${source}`);
    } catch (error) {
      logger.error(`Failed to parse ${source}:`, error);
      throw error;
    }
  }
  
  return mergeParseResults(results);
}


// File Parsing


async function parseFromFile(
  filePath: string,
  _config: ResolvedConfig,
  logger: Logger
): Promise<ParseResult> {
  // Resolve to absolute path
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Documentation file not found: ${absolutePath}`);
  }
  
  // Determine file type
  if (isOpenAPIFile(absolutePath)) {
    logger.debug(`Parsing as OpenAPI: ${absolutePath}`);
    return parseOpenAPI(absolutePath);
  }
  
  if (isTypeScriptFile(absolutePath)) {
    logger.debug(`Parsing as TypeScript/JavaScript: ${absolutePath}`);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return parseTypeScript(content, absolutePath);
  }
  
  if (isMarkdownFile(absolutePath)) {
    logger.debug(`Parsing as Markdown: ${absolutePath}`);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return parseMarkdown(content, absolutePath);
  }
  
  // Try to detect from content
  const content = await fs.readFile(absolutePath, 'utf-8');
  
  if (isOpenAPIContent(content)) {
    logger.debug(`Detected OpenAPI content in: ${absolutePath}`);
    return parseOpenAPI(absolutePath);
  }
  
  // Default to markdown
  logger.debug(`Defaulting to Markdown parser for: ${absolutePath}`);
  return parseMarkdown(content, absolutePath);
}


// URL Parsing


async function parseFromURL(
  url: string,
  _config: ResolvedConfig,
  logger: Logger
): Promise<ParseResult> {
  logger.debug(`Fetching documentation from URL: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch documentation from ${url}: ${response.status} ${response.statusText}`);
  }
  
  const content = await response.text();
  const contentType = response.headers.get('content-type') || '';
  
  // Determine parser based on content type or URL
  if (
    contentType.includes('yaml') || 
    contentType.includes('json') ||
    url.includes('openapi') ||
    url.includes('swagger') ||
    isOpenAPIContent(content)
  ) {
    // For URLs, swagger-parser can handle them directly
    return parseOpenAPI(url);
  }
  
  // Parse as markdown
  return parseMarkdown(content, url);
}


// Glob Pattern Parsing


/**
 * Check if a source string contains glob patterns
 */
function isGlobPattern(source: string): boolean {
  return source.includes('*') || source.includes('?') || source.includes('{');
}

/**
 * Parse multiple files matching a glob pattern
 */
async function parseGlobPattern(
  pattern: string,
  config: ResolvedConfig,
  logger: Logger
): Promise<ParseResult> {
  logger.debug(`Expanding glob pattern: ${pattern}`);
  
  // Find all matching files
  const files = await glob(pattern, { 
    nodir: true,
    absolute: true,
    cwd: process.cwd(),
  });
  
  if (files.length === 0) {
    logger.warn(`No files matched pattern: ${pattern}`);
    return {
      metadata: {},
      endpoints: [],
      schemas: {},
      auth: {},
      resources: [],
    };
  }
  
  logger.info(`Found ${files.length} files matching pattern: ${pattern}`);
  
  // Parse each file
  const results: ParseResult[] = [];
  for (const file of files) {
    try {
      const result = await parseFromFile(file, config, logger);
      results.push(result);
      logger.debug(`Parsed: ${file}`);
    } catch (error) {
      logger.error(`Failed to parse ${file}:`, error);
    }
  }
  
  return mergeParseResults(results);
}


// Result Merging


/**
 * Merge multiple parse results into a single result
 */
function mergeParseResults(results: ParseResult[]): ParseResult {
  if (results.length === 0) {
    return {
      metadata: {},
      endpoints: [],
      schemas: {},
      auth: {},
      resources: [],
    };
  }
  
  if (results.length === 1) {
    return results[0];
  }
  
  // Merge all results
  const merged: ParseResult = {
    metadata: {},
    endpoints: [],
    schemas: {},
    auth: {
      schemes: {},
    },
    resources: [],
  };
  
  for (const result of results) {
    // Merge metadata (first non-empty values win)
    merged.metadata = {
      title: merged.metadata.title || result.metadata.title,
      description: merged.metadata.description || result.metadata.description,
      version: merged.metadata.version || result.metadata.version,
      termsOfService: merged.metadata.termsOfService || result.metadata.termsOfService,
      contact: merged.metadata.contact || result.metadata.contact,
      license: merged.metadata.license || result.metadata.license,
      servers: [...(merged.metadata.servers || []), ...(result.metadata.servers || [])],
      custom: { ...merged.metadata.custom, ...result.metadata.custom },
    };
    
    // Merge endpoints
    merged.endpoints.push(...result.endpoints);
    
    // Merge schemas
    Object.assign(merged.schemas, result.schemas);
    
    // Merge auth
    Object.assign(merged.auth.schemes!, result.auth.schemes || {});
    if (result.auth.defaultSecurity) {
      merged.auth.defaultSecurity = [
        ...(merged.auth.defaultSecurity || []),
        ...result.auth.defaultSecurity,
      ];
    }
    if (result.auth.description && !merged.auth.description) {
      merged.auth.description = result.auth.description;
    }
    
    // Merge resources (documentation)
    if (result.resources) {
      merged.resources!.push(...result.resources);
    }
  }
  
  // Deduplicate servers
  if (merged.metadata.servers) {
    const seen = new Set<string>();
    merged.metadata.servers = merged.metadata.servers.filter(server => {
      if (seen.has(server.url)) return false;
      seen.add(server.url);
      return true;
    });
  }
  
  // Deduplicate resources by ID
  if (merged.resources) {
    const seenIds = new Set<string>();
    merged.resources = merged.resources.filter(resource => {
      if (seenIds.has(resource.id)) return false;
      seenIds.add(resource.id);
      return true;
    });
  }
  
  return merged;
}


// Utilities


function isURL(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

function matchesParser(source: string, parser: CustomParser): boolean {
  const ext = path.extname(source).toLowerCase();
  return parser.extensions.some(pattern => {
    if (pattern.startsWith('.')) {
      return ext === pattern;
    }
    return source.includes(pattern);
  });
}

async function readSource(source: string): Promise<string> {
  if (isURL(source)) {
    const response = await fetch(source);
    return response.text();
  }
  return fs.readFile(source, 'utf-8');
}

// Re-export individual parsers for direct use
export { parseOpenAPI, isOpenAPIFile, isOpenAPIContent } from './openapi';
export { parseMarkdown, isMarkdownFile } from './markdown';
export { parseTypeScript, isTypeScriptFile } from './typescript';
