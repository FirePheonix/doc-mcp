/**
 * doc-mcp - MCP Router
 * 
 * Defines and handles all MCP endpoints.
 * Provides structured, machine-readable API documentation.
 */

import type {
  NormalizedSchema,
  ResolvedConfig,
  McpDescribeResponse,
  McpSchemasResponse,
  McpEndpointsResponse,
  McpAuthResponse,
  McpHandlers,
  EndpointSchema,
} from '../types';


// Handler Factory


/**
 * Create MCP endpoint handlers from a normalized schema
 */
export function createMcpHandlers(
  schema: NormalizedSchema,
  _config: ResolvedConfig
): McpHandlers {
  return {
    describe: () => handleDescribe(schema),
    schemas: () => handleSchemas(schema),
    endpoints: (query) => handleEndpoints(schema, query),
    auth: () => handleAuth(schema),
  };
}


// /mcp/describe Handler


/**
 * Handle GET /mcp/describe
 * Returns high-level API description, metadata, and versioning info
 */
function handleDescribe(schema: NormalizedSchema): McpDescribeResponse {
  const { metadata, source } = schema;
  
  return {
    name: metadata.title || 'API',
    description: metadata.description || '',
    version: metadata.version || '1.0.0',
    servers: metadata.servers || [],
    contact: metadata.contact,
    license: metadata.license,
    documentation: {
      type: source.type,
      sources: source.files,
    },
    generatedAt: source.parsedAt,
  };
}


// /mcp/schemas Handler


/**
 * Handle GET /mcp/schemas
 * Returns normalized API schemas (OpenAPI-like JSON)
 */
function handleSchemas(schema: NormalizedSchema): McpSchemasResponse {
  return {
    schemas: schema.schemas,
    count: Object.keys(schema.schemas).length,
  };
}


// /mcp/endpoints Handler


interface EndpointsQuery {
  tag?: string;
  method?: string;
  path?: string;
  deprecated?: boolean;
}

/**
 * Handle GET /mcp/endpoints
 * Returns list of available API endpoints with methods and params
 */
function handleEndpoints(
  schema: NormalizedSchema,
  query?: EndpointsQuery
): McpEndpointsResponse {
  let endpoints = schema.endpoints;
  
  // Apply filters if provided
  if (query) {
    endpoints = filterEndpoints(endpoints, query);
  }
  
  // Collect unique tags
  const tags = new Set<string>();
  for (const endpoint of schema.endpoints) {
    for (const tag of endpoint.tags || []) {
      tags.add(tag);
    }
  }
  
  return {
    endpoints,
    count: endpoints.length,
    tags: Array.from(tags).sort(),
  };
}

/**
 * Filter endpoints based on query parameters
 */
function filterEndpoints(
  endpoints: EndpointSchema[],
  query: EndpointsQuery
): EndpointSchema[] {
  return endpoints.filter(endpoint => {
    // Filter by tag
    if (query.tag) {
      if (!endpoint.tags || !endpoint.tags.includes(query.tag)) {
        return false;
      }
    }
    
    // Filter by method
    if (query.method) {
      if (endpoint.method.toUpperCase() !== query.method.toUpperCase()) {
        return false;
      }
    }
    
    // Filter by path (substring match)
    if (query.path) {
      if (!endpoint.path.includes(query.path)) {
        return false;
      }
    }
    
    // Filter deprecated
    if (query.deprecated !== undefined) {
      if (endpoint.deprecated !== query.deprecated) {
        return false;
      }
    }
    
    return true;
  });
}


// /mcp/auth Handler


/**
 * Handle GET /mcp/auth
 * Returns authentication requirements and headers
 */
function handleAuth(schema: NormalizedSchema): McpAuthResponse {
  const { auth } = schema;
  
  // Generate usage instructions
  const instructions = generateAuthInstructions(auth.schemes);
  
  return {
    schemes: auth.schemes,
    defaultSecurity: auth.defaultSecurity || [],
    description: auth.description || 'No authentication configured.',
    instructions,
  };
}

/**
 * Generate human-readable authentication instructions
 */
function generateAuthInstructions(schemes: Record<string, unknown>): string {
  const instructions: string[] = [];
  
  for (const [name, scheme] of Object.entries(schemes)) {
    const s = scheme as { type: string; name?: string; in?: string; scheme?: string };
    
    switch (s.type) {
      case 'apiKey':
        instructions.push(
          `**${name}** (API Key):\n` +
          `Add the \`${s.name}\` ${s.in} to your request.\n` +
          `Example: \`${s.name}: your-api-key\``
        );
        break;
      
      case 'http':
        if (s.scheme === 'bearer') {
          instructions.push(
            `**${name}** (Bearer Token):\n` +
            `Add the Authorization header with a Bearer token.\n` +
            `Example: \`Authorization: Bearer your-token\``
          );
        } else if (s.scheme === 'basic') {
          instructions.push(
            `**${name}** (Basic Auth):\n` +
            `Add the Authorization header with Base64-encoded credentials.\n` +
            `Example: \`Authorization: Basic base64(username:password)\``
          );
        }
        break;
      
      case 'oauth2':
        instructions.push(
          `**${name}** (OAuth 2.0):\n` +
          `Obtain an access token through the OAuth 2.0 flow.\n` +
          `Include it as: \`Authorization: Bearer your-access-token\``
        );
        break;
      
      case 'openIdConnect':
        instructions.push(
          `**${name}** (OpenID Connect):\n` +
          `Authenticate via OpenID Connect to obtain a token.\n` +
          `Include it as: \`Authorization: Bearer your-token\``
        );
        break;
    }
  }
  
  if (instructions.length === 0) {
    return 'This API does not require authentication.';
  }
  
  return instructions.join('\n\n');
}


// Route Definitions


/**
 * Get MCP route definitions for mounting
 */
export function getMcpRoutes(basePath: string): Array<{
  method: 'GET';
  path: string;
  handler: keyof McpHandlers;
  description: string;
}> {
  const normalize = (p: string) => `${basePath}${p}`.replace(/\/+/g, '/');
  
  return [
    {
      method: 'GET',
      path: normalize('/describe'),
      handler: 'describe',
      description: 'High-level API description, metadata, versioning info',
    },
    {
      method: 'GET',
      path: normalize('/schemas'),
      handler: 'schemas',
      description: 'Normalized API schemas (OpenAPI-like JSON)',
    },
    {
      method: 'GET',
      path: normalize('/endpoints'),
      handler: 'endpoints',
      description: 'List of available API endpoints with methods and params',
    },
    {
      method: 'GET',
      path: normalize('/auth'),
      handler: 'auth',
      description: 'Authentication requirements and headers',
    },
  ];
}

export { McpHandlers };
