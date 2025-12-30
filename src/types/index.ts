/**
 * doc-mcp - Type Definitions
 * 
 * Core type definitions for the doc-mcp framework.
 * These types define the internal schema and public API interfaces.
 */

import type { FastifyInstance } from 'fastify';


// Configuration Types


/**
 * Authentication configuration for MCP endpoints
 */
export interface AuthConfig {
  /** Type of authentication */
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2';
  /** Name of the header/query param for API key auth */
  name?: string;
  /** Location of the API key: header, query, or cookie */
  in?: 'header' | 'query' | 'cookie';
  /** OAuth2 configuration */
  oauth2?: {
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: Record<string, string>;
  };
  /** Description of auth requirements */
  description?: string;
}

/**
 * Visibility configuration for endpoints
 */
export interface VisibilityConfig {
  /** Endpoints to include (glob patterns or exact paths) */
  include?: string[];
  /** Endpoints to exclude (glob patterns or exact paths) */
  exclude?: string[];
  /** Whether to expose internal/private endpoints */
  exposeInternal?: boolean;
}

/**
 * Main configuration options for doc-mcp
 */
export interface DocMcpConfig {
  /** Path or URL to OpenAPI spec or markdown documentation */
  docs: string | string[];
  /** Base path where MCP endpoints are mounted (default: '/mcp') */
  basePath?: string;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Visibility configuration for endpoints */
  visibility?: VisibilityConfig;
  /** API metadata overrides */
  metadata?: ApiMetadata;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom parsers */
  parsers?: CustomParser[];
}

/**
 * Resolved configuration with defaults applied
 */
export interface ResolvedConfig extends Required<Omit<DocMcpConfig, 'docs' | 'auth' | 'visibility' | 'metadata' | 'parsers'>> {
  docs: string[];
  auth: AuthConfig;
  visibility: VisibilityConfig;
  metadata: ApiMetadata;
  parsers: CustomParser[];
}


// API Schema Types (Normalized Internal Format)


/**
 * API metadata and high-level information
 */
export interface ApiMetadata {
  /** API title */
  title?: string;
  /** API description */
  description?: string;
  /** API version */
  version?: string;
  /** Terms of service URL */
  termsOfService?: string;
  /** Contact information */
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  /** License information */
  license?: {
    name?: string;
    url?: string;
  };
  /** Base URL(s) of the API */
  servers?: ServerInfo[];
  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Server/base URL information
 */
export interface ServerInfo {
  url: string;
  description?: string;
  variables?: Record<string, {
    default: string;
    enum?: string[];
    description?: string;
  }>;
}

/**
 * Parameter definition for endpoints
 */
export interface ParameterSchema {
  /** Parameter name */
  name: string;
  /** Location of the parameter */
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  /** Whether the parameter is required */
  required: boolean;
  /** Parameter description */
  description?: string;
  /** Parameter type */
  type: string;
  /** JSON Schema for complex types */
  schema?: JsonSchema;
  /** Example value */
  example?: unknown;
  /** Deprecated flag */
  deprecated?: boolean;
}

/**
 * Response definition for endpoints
 */
export interface ResponseSchema {
  /** HTTP status code */
  statusCode: number | string;
  /** Response description */
  description?: string;
  /** Content type to schema mapping */
  content?: Record<string, {
    schema?: JsonSchema;
    example?: unknown;
    examples?: Record<string, { value: unknown; summary?: string }>;
  }>;
  /** Response headers */
  headers?: Record<string, {
    description?: string;
    schema?: JsonSchema;
  }>;
}

/**
 * Normalized endpoint definition
 */
export interface EndpointSchema {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  /** Endpoint path */
  path: string;
  /** Operation ID (unique identifier) */
  operationId?: string;
  /** Short summary */
  summary?: string;
  /** Detailed description */
  description?: string;
  /** Tags/categories */
  tags?: string[];
  /** Parameters */
  parameters: ParameterSchema[];
  /** Request body schema */
  requestBody?: {
    required?: boolean;
    description?: string;
    content: Record<string, {
      schema?: JsonSchema;
      example?: unknown;
    }>;
  };
  /** Response definitions */
  responses: ResponseSchema[];
  /** Security requirements */
  security?: SecurityRequirement[];
  /** Deprecated flag */
  deprecated?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Security requirement definition
 */
export interface SecurityRequirement {
  /** Security scheme name to scopes mapping */
  [schemeName: string]: string[];
}

/**
 * Complete normalized API schema
 */
export interface NormalizedSchema {
  /** API metadata */
  metadata: ApiMetadata;
  /** All endpoints */
  endpoints: EndpointSchema[];
  /** Reusable schemas/components */
  schemas: Record<string, JsonSchema>;
  /** Authentication information */
  auth: AuthInfo;
  /** Raw source information */
  source: {
    type: 'openapi' | 'markdown' | 'mixed';
    files: string[];
    parsedAt: string;
  };
}

/**
 * Authentication information for the API
 */
export interface AuthInfo {
  /** Available security schemes */
  schemes: Record<string, SecurityScheme>;
  /** Default security requirements */
  defaultSecurity?: SecurityRequirement[];
  /** Human-readable auth description */
  description?: string;
}

/**
 * Security scheme definition
 */
export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  description?: string;
  flows?: {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
  };
  openIdConnectUrl?: string;
}

/**
 * OAuth flow definition
 */
export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}


// JSON Schema Types (subset for API schemas)


/**
 * JSON Schema definition (simplified)
 */
export interface JsonSchema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  
  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  
  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  
  // Array
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  
  // Object
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  
  // Composition
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  
  // References
  $ref?: string;
  
  // Examples
  example?: unknown;
  examples?: unknown[];
  
  // Nullable
  nullable?: boolean;
}


// MCP Response Types


/**
 * Response for /mcp/describe endpoint
 */
export interface McpDescribeResponse {
  name: string;
  description: string;
  version: string;
  servers: ServerInfo[];
  contact?: ApiMetadata['contact'];
  license?: ApiMetadata['license'];
  documentation?: {
    type: string;
    sources: string[];
  };
  generatedAt: string;
}

/**
 * Response for /mcp/schemas endpoint
 */
export interface McpSchemasResponse {
  schemas: Record<string, JsonSchema>;
  count: number;
}

/**
 * Response for /mcp/endpoints endpoint
 */
export interface McpEndpointsResponse {
  endpoints: EndpointSchema[];
  count: number;
  tags: string[];
}

/**
 * Response for /mcp/auth endpoint
 */
export interface McpAuthResponse {
  schemes: Record<string, SecurityScheme>;
  defaultSecurity: SecurityRequirement[];
  description: string;
  instructions: string;
}


// Parser Types


/**
 * Parser result interface
 */
export interface ParseResult {
  metadata: Partial<ApiMetadata>;
  endpoints: Partial<EndpointSchema>[];
  schemas: Record<string, JsonSchema>;
  auth: Partial<AuthInfo>;
}

/**
 * Custom parser interface
 */
export interface CustomParser {
  /** File extensions or patterns this parser handles */
  extensions: string[];
  /** Parse function */
  parse: (content: string, filePath: string) => Promise<ParseResult>;
}

/**
 * Parser context passed to parsers
 */
export interface ParserContext {
  filePath: string;
  content: string;
  config: ResolvedConfig;
}


// Server Adapter Types


/**
 * Supported server frameworks
 */
export type ServerFramework = 'express' | 'fastify' | 'standalone';

/**
 * Express application type (loose to avoid direct dependency)
 */
export interface ExpressApp {
  use: (path: string, handler: unknown) => void;
  get: (path: string, handler: unknown) => void;
  [key: string]: unknown;
}

/**
 * Server adapter interface
 */
export interface ServerAdapter {
  /** Framework type */
  type: ServerFramework;
  /** Mount MCP routes on the server */
  mount: (schema: NormalizedSchema, config: ResolvedConfig) => void;
  /** Get the underlying server instance */
  getServer: () => unknown;
}

/**
 * Adapter factory options
 */
export interface AdapterOptions {
  /** Existing Express app */
  express?: ExpressApp;
  /** Existing Fastify instance */
  fastify?: FastifyInstance;
  /** Create standalone Fastify server */
  standalone?: {
    port?: number;
    host?: string;
  };
}


// Public API Types


/**
 * doc-mcp instance interface
 */
export interface DocMcpInstance {
  /** Get the normalized schema */
  getSchema: () => NormalizedSchema;
  /** Get the resolved configuration */
  getConfig: () => ResolvedConfig;
  /** Reload documentation sources */
  reload: () => Promise<void>;
  /** Get MCP endpoint handlers */
  getHandlers: () => McpHandlers;
}

/**
 * MCP endpoint handlers
 */
export interface McpHandlers {
  describe: () => McpDescribeResponse;
  schemas: () => McpSchemasResponse;
  endpoints: (query?: { tag?: string; method?: string; path?: string; deprecated?: boolean }) => McpEndpointsResponse;
  auth: () => McpAuthResponse;
}

/**
 * Main docmcp function signature
 */
export type DocMcpFunction = {
  (app: ExpressApp | FastifyInstance, config: DocMcpConfig): Promise<DocMcpInstance>;
  (config: DocMcpConfig & { standalone: true; port?: number; host?: string }): Promise<DocMcpInstance & { listen: () => Promise<void> }>;
};


// Utility Types


/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Logger interface
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
