/**
 * doc-mcp - Schema Normalizer
 * 
 * Normalizes parsed documentation into a consistent internal schema format.
 * Handles merging, validation, and enrichment of API documentation.
 */

import type {
  ParseResult,
  NormalizedSchema,
  ResolvedConfig,
  ApiMetadata,
  EndpointSchema,
  ParameterSchema,
  ResponseSchema,
  AuthInfo,
  JsonSchema,
  SecurityScheme,
  Logger,
} from '../types';
import { isPathVisible } from '../core/config';


// Main Normalizer


/**
 * Normalize a parse result into the final schema
 */
export function normalizeSchema(
  parseResult: ParseResult,
  config: ResolvedConfig,
  sources: string[],
  logger: Logger
): NormalizedSchema {
  logger.debug('Normalizing parsed documentation...');
  
  // Normalize metadata
  const metadata = normalizeMetadata(parseResult.metadata, config);
  
  // Normalize endpoints with visibility filtering
  const endpoints = normalizeEndpoints(parseResult.endpoints, config, logger);
  
  // Normalize schemas
  const schemas = normalizeSchemas(parseResult.schemas, logger);
  
  // Normalize auth info
  const auth = normalizeAuth(parseResult.auth, config);
  
  // Get resources (documentation)
  const resources = parseResult.resources || [];
  
  // Determine source type
  const sourceType = determineSourceType(sources);
  
  const normalized: NormalizedSchema = {
    metadata,
    endpoints,
    schemas,
    auth,
    resources,
    source: {
      type: sourceType,
      files: sources,
      parsedAt: new Date().toISOString(),
    },
  };
  
  logger.debug(`Normalized schema: ${endpoints.length} endpoints, ${Object.keys(schemas).length} schemas, ${resources.length} resources`);
  
  return normalized;
}


// Metadata Normalization


function normalizeMetadata(
  parsed: Partial<ApiMetadata>,
  config: ResolvedConfig
): ApiMetadata {
  // Merge parsed metadata with config overrides
  return {
    title: config.metadata.title || parsed.title || 'API Documentation',
    description: config.metadata.description || parsed.description || 'API documentation served via doc-mcp',
    version: config.metadata.version || parsed.version || '1.0.0',
    termsOfService: config.metadata.termsOfService || parsed.termsOfService,
    contact: config.metadata.contact || parsed.contact,
    license: config.metadata.license || parsed.license,
    servers: config.metadata.servers || parsed.servers || [],
    custom: {
      ...parsed.custom,
      ...config.metadata.custom,
    },
  };
}


// Endpoint Normalization


function normalizeEndpoints(
  parsed: Partial<EndpointSchema>[],
  config: ResolvedConfig,
  logger: Logger
): EndpointSchema[] {
  const normalized: EndpointSchema[] = [];
  const seen = new Set<string>();
  
  for (const endpoint of parsed) {
    // Skip invalid endpoints
    if (!endpoint.method || !endpoint.path) {
      logger.warn(`Skipping endpoint without method or path: ${JSON.stringify(endpoint)}`);
      continue;
    }
    
    // Apply visibility filter
    if (!isPathVisible(endpoint.path, config.visibility)) {
      logger.debug(`Filtering out endpoint due to visibility: ${endpoint.method} ${endpoint.path}`);
      continue;
    }
    
    // Check for duplicates
    const key = `${endpoint.method}:${endpoint.path}`;
    if (seen.has(key)) {
      logger.debug(`Skipping duplicate endpoint: ${key}`);
      continue;
    }
    seen.add(key);
    
    // Normalize the endpoint
    const normalizedEndpoint: EndpointSchema = {
      method: endpoint.method.toUpperCase() as EndpointSchema['method'],
      path: normalizePath(endpoint.path),
      operationId: endpoint.operationId || generateOperationId(endpoint.method, endpoint.path),
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags || [],
      parameters: normalizeParameters(endpoint.parameters || []),
      responses: normalizeResponses(endpoint.responses || []),
      requestBody: endpoint.requestBody,
      security: endpoint.security,
      deprecated: endpoint.deprecated || false,
      metadata: endpoint.metadata,
    };
    
    normalized.push(normalizedEndpoint);
  }
  
  // Sort endpoints by path, then method
  normalized.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    return methodOrder(a.method) - methodOrder(b.method);
  });
  
  return normalized;
}

function normalizePath(path: string): string {
  // Ensure leading slash
  let normalized = path.startsWith('/') ? path : `/${path}`;
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Normalize path parameters
  normalized = normalized.replace(/:(\w+)/g, '{$1}');
  return normalized;
}

function normalizeParameters(params: ParameterSchema[]): ParameterSchema[] {
  return params.map(param => ({
    name: param.name,
    in: param.in,
    required: param.required ?? (param.in === 'path'),
    description: param.description,
    type: param.type || 'string',
    schema: param.schema,
    example: param.example,
    deprecated: param.deprecated || false,
  }));
}

function normalizeResponses(responses: ResponseSchema[]): ResponseSchema[] {
  // Ensure at least a default success response
  if (responses.length === 0) {
    return [{
      statusCode: 200,
      description: 'Successful response',
    }];
  }
  
  return responses.map(response => ({
    statusCode: response.statusCode,
    description: response.description || getDefaultResponseDescription(response.statusCode),
    content: response.content,
    headers: response.headers,
  }));
}

function generateOperationId(method: string, path: string): string {
  // Convert path to camelCase operation ID
  const parts = path
    .replace(/[{}]/g, '')
    .split('/')
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
  
  return `${method.toLowerCase()}${parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`;
}

function methodOrder(method: string): number {
  const order: Record<string, number> = {
    GET: 0,
    POST: 1,
    PUT: 2,
    PATCH: 3,
    DELETE: 4,
    HEAD: 5,
    OPTIONS: 6,
  };
  return order[method] ?? 99;
}

function getDefaultResponseDescription(statusCode: number | string): string {
  const descriptions: Record<number, string> = {
    200: 'Successful response',
    201: 'Resource created',
    204: 'No content',
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    500: 'Internal server error',
  };
  
  if (typeof statusCode === 'string') {
    return statusCode === 'default' ? 'Default response' : 'Response';
  }
  
  return descriptions[statusCode] || 'Response';
}


// Schema Normalization


function normalizeSchemas(
  schemas: Record<string, JsonSchema>,
  logger: Logger
): Record<string, JsonSchema> {
  const normalized: Record<string, JsonSchema> = {};
  
  for (const [name, schema] of Object.entries(schemas)) {
    normalized[name] = normalizeJsonSchema(schema);
  }
  
  logger.debug(`Normalized ${Object.keys(normalized).length} schemas`);
  
  return normalized;
}

function normalizeJsonSchema(schema: JsonSchema): JsonSchema {
  const normalized: JsonSchema = { ...schema };
  
  // Ensure type is always present if properties exist
  if (normalized.properties && !normalized.type) {
    normalized.type = 'object';
  }
  
  // Ensure items type for arrays
  if (normalized.items && !normalized.type) {
    normalized.type = 'array';
  }
  
  // Recursively normalize nested schemas
  if (normalized.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(normalized.properties).map(([key, val]) => [key, normalizeJsonSchema(val)])
    );
  }
  
  if (normalized.items && !Array.isArray(normalized.items)) {
    normalized.items = normalizeJsonSchema(normalized.items);
  }
  
  if (normalized.additionalProperties && typeof normalized.additionalProperties === 'object') {
    normalized.additionalProperties = normalizeJsonSchema(normalized.additionalProperties);
  }
  
  if (normalized.allOf) {
    normalized.allOf = normalized.allOf.map(normalizeJsonSchema);
  }
  
  if (normalized.anyOf) {
    normalized.anyOf = normalized.anyOf.map(normalizeJsonSchema);
  }
  
  if (normalized.oneOf) {
    normalized.oneOf = normalized.oneOf.map(normalizeJsonSchema);
  }
  
  return normalized;
}


// Auth Normalization


function normalizeAuth(
  parsed: Partial<AuthInfo>,
  config: ResolvedConfig
): AuthInfo {
  const schemes: Record<string, SecurityScheme> = { ...parsed.schemes };
  
  // Add auth from config if specified
  if (config.auth.type !== 'none') {
    const configScheme = createSecuritySchemeFromConfig(config);
    if (configScheme) {
      schemes['configured'] = configScheme;
    }
  }
  
  // Generate description
  let description = parsed.description || '';
  if (Object.keys(schemes).length === 0) {
    description = 'No authentication required.';
  } else if (!description) {
    description = generateAuthDescription(schemes);
  }
  
  return {
    schemes,
    defaultSecurity: parsed.defaultSecurity || [],
    description,
  };
}

function createSecuritySchemeFromConfig(config: ResolvedConfig): SecurityScheme | null {
  switch (config.auth.type) {
    case 'apiKey':
      return {
        type: 'apiKey',
        name: config.auth.name || 'X-API-Key',
        in: config.auth.in || 'header',
        description: config.auth.description,
      };
    
    case 'bearer':
      return {
        type: 'http',
        scheme: 'bearer',
        description: config.auth.description,
      };
    
    case 'basic':
      return {
        type: 'http',
        scheme: 'basic',
        description: config.auth.description,
      };
    
    case 'oauth2':
      return {
        type: 'oauth2',
        description: config.auth.description,
        flows: config.auth.oauth2 ? {
          authorizationCode: {
            authorizationUrl: config.auth.oauth2.authorizationUrl || '',
            tokenUrl: config.auth.oauth2.tokenUrl || '',
            scopes: config.auth.oauth2.scopes || {},
          },
        } : undefined,
      };
    
    default:
      return null;
  }
}

function generateAuthDescription(schemes: Record<string, SecurityScheme>): string {
  const parts: string[] = ['This API supports the following authentication methods:'];
  
  for (const [name, scheme] of Object.entries(schemes)) {
    if (scheme.type === 'apiKey') {
      parts.push(`- **${name}**: API Key in ${scheme.in} (${scheme.name})`);
    } else if (scheme.type === 'http') {
      parts.push(`- **${name}**: HTTP ${scheme.scheme} authentication`);
    } else if (scheme.type === 'oauth2') {
      parts.push(`- **${name}**: OAuth 2.0`);
    } else if (scheme.type === 'openIdConnect') {
      parts.push(`- **${name}**: OpenID Connect`);
    }
  }
  
  return parts.join('\n');
}


// Utilities


function determineSourceType(sources: string[]): 'openapi' | 'markdown' | 'mixed' {
  const hasOpenAPI = sources.some(s => 
    s.includes('openapi') || 
    s.includes('swagger') || 
    s.endsWith('.yaml') || 
    s.endsWith('.yml') || 
    s.endsWith('.json')
  );
  
  const hasMarkdown = sources.some(s => 
    s.endsWith('.md') || 
    s.endsWith('.markdown')
  );
  
  if (hasOpenAPI && hasMarkdown) return 'mixed';
  if (hasMarkdown) return 'markdown';
  return 'openapi';
}
