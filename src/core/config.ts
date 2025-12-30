/**
 * doc-mcp - Configuration Loader
 * 
 * Handles loading and resolving configuration from multiple sources:
 * - Direct options passed to docmcp()
 * - Environment variables
 * - Config files
 */

import { z } from 'zod';
import type { DocMcpConfig, ResolvedConfig, AuthConfig, VisibilityConfig, ApiMetadata, CustomParser } from '../types';

// Zod Schemas for Validation

const authConfigSchema = z.object({
  type: z.enum(['none', 'apiKey', 'bearer', 'basic', 'oauth2']).default('none'),
  name: z.string().optional(),
  in: z.enum(['header', 'query', 'cookie']).optional(),
  oauth2: z.object({
    authorizationUrl: z.string().optional(),
    tokenUrl: z.string().optional(),
    scopes: z.record(z.string()).optional(),
  }).optional(),
  description: z.string().optional(),
});

const visibilityConfigSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  exposeInternal: z.boolean().default(false),
});

const metadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  termsOfService: z.string().optional(),
  contact: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  license: z.object({
    name: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  servers: z.array(z.object({
    url: z.string(),
    description: z.string().optional(),
    variables: z.record(z.object({
      default: z.string(),
      enum: z.array(z.string()).optional(),
      description: z.string().optional(),
    })).optional(),
  })).optional(),
  custom: z.record(z.unknown()).optional(),
});

const configSchema = z.object({
  docs: z.union([z.string(), z.array(z.string())]),
  basePath: z.string().default('/mcp'),
  auth: authConfigSchema.optional(),
  visibility: visibilityConfigSchema.optional(),
  metadata: metadataSchema.optional(),
  verbose: z.boolean().default(false),
  parsers: z.array(z.any()).optional(),
});


// Default Configuration


const DEFAULT_AUTH: AuthConfig = {
  type: 'none',
};

const DEFAULT_VISIBILITY: VisibilityConfig = {
  include: undefined,
  exclude: undefined,
  exposeInternal: false,
};

const DEFAULT_METADATA: ApiMetadata = {
  title: 'API Documentation',
  description: 'API documentation served via doc-mcp',
  version: '1.0.0',
};


// Environment Variable Loading


interface EnvConfig {
  docs?: string;
  basePath?: string;
  verbose?: boolean;
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): EnvConfig {
  const env: EnvConfig = {};
  
  if (process.env.DOC_MCP_DOCS) {
    env.docs = process.env.DOC_MCP_DOCS;
  }
  
  if (process.env.DOC_MCP_BASE_PATH) {
    env.basePath = process.env.DOC_MCP_BASE_PATH;
  }
  
  if (process.env.DOC_MCP_VERBOSE) {
    env.verbose = process.env.DOC_MCP_VERBOSE === 'true' || process.env.DOC_MCP_VERBOSE === '1';
  }
  
  return env;
}


// Configuration Resolution


/**
 * Normalize the base path to ensure consistent format
 */
function normalizeBasePath(basePath: string): string {
  // Ensure leading slash
  let normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
  // Remove trailing slash
  normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  return normalized;
}

/**
 * Normalize docs input to always be an array
 */
function normalizeDocs(docs: string | string[]): string[] {
  return Array.isArray(docs) ? docs : [docs];
}

/**
 * Validate and resolve configuration
 */
export function resolveConfig(options: DocMcpConfig): ResolvedConfig {
  // Load environment variables
  const envConfig = loadEnvConfig();
  
  // Merge environment config with options (options take precedence)
  const mergedOptions = {
    ...envConfig,
    ...options,
    docs: options.docs || envConfig.docs,
    basePath: options.basePath || envConfig.basePath || '/mcp',
    verbose: options.verbose ?? envConfig.verbose ?? false,
  };
  
  // Validate with Zod
  const validated = configSchema.parse(mergedOptions);
  
  // Build resolved config
  const resolved: ResolvedConfig = {
    docs: normalizeDocs(validated.docs),
    basePath: normalizeBasePath(validated.basePath),
    auth: validated.auth ? { ...DEFAULT_AUTH, ...validated.auth } : DEFAULT_AUTH,
    visibility: validated.visibility ? { ...DEFAULT_VISIBILITY, ...validated.visibility } : DEFAULT_VISIBILITY,
    metadata: validated.metadata ? { ...DEFAULT_METADATA, ...validated.metadata } : DEFAULT_METADATA,
    verbose: validated.verbose,
    parsers: (validated.parsers as CustomParser[]) || [],
  };
  
  return resolved;
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(config: ResolvedConfig): void {
  if (!config.docs || config.docs.length === 0) {
    throw new Error('doc-mcp: "docs" configuration is required. Provide a path or URL to your API documentation.');
  }
  
  // Validate base path format
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(config.basePath)) {
    throw new Error(`doc-mcp: Invalid basePath "${config.basePath}". Must start with "/" and contain only alphanumeric characters, underscores, hyphens, and slashes.`);
  }
}


// Configuration Utilities


/**
 * Create a minimal default configuration
 */
export function createDefaultConfig(docs: string | string[]): DocMcpConfig {
  return {
    docs,
    basePath: '/mcp',
  };
}

/**
 * Merge two configurations (second takes precedence)
 */
export function mergeConfigs(base: Partial<DocMcpConfig>, override: Partial<DocMcpConfig>): DocMcpConfig {
  return {
    docs: override.docs || base.docs || '',
    basePath: override.basePath || base.basePath,
    auth: override.auth || base.auth,
    visibility: {
      ...base.visibility,
      ...override.visibility,
    },
    metadata: {
      ...base.metadata,
      ...override.metadata,
    },
    verbose: override.verbose ?? base.verbose,
    parsers: [...(base.parsers || []), ...(override.parsers || [])],
  };
}

/**
 * Check if a path should be visible based on visibility config
 */
export function isPathVisible(path: string, visibility: VisibilityConfig): boolean {
  // Check excludes first
  if (visibility.exclude) {
    for (const pattern of visibility.exclude) {
      if (matchesPattern(path, pattern)) {
        return false;
      }
    }
  }
  
  // If includes are specified, path must match one
  if (visibility.include && visibility.include.length > 0) {
    for (const pattern of visibility.include) {
      if (matchesPattern(path, pattern)) {
        return true;
      }
    }
    return false;
  }
  
  // Default: visible
  return true;
}

/**
 * Simple glob-like pattern matching
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export { configSchema, authConfigSchema, visibilityConfigSchema, metadataSchema };
