/**
 * doc-mcp - OpenAPI Parser
 * 
 * Parses OpenAPI 2.0 (Swagger) and OpenAPI 3.x specifications
 * into the normalized internal schema format.
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type {
  ParseResult,
  ApiMetadata,
  EndpointSchema,
  ParameterSchema,
  ResponseSchema,
  JsonSchema,
  AuthInfo,
  SecurityScheme,
  OAuthFlow,
} from '../types';

type OpenAPIDocument = OpenAPI.Document;
type OpenAPIV3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;


// OpenAPI Parser


/**
 * Parse an OpenAPI specification file
 */
export async function parseOpenAPI(source: string): Promise<ParseResult> {
  // Use swagger-parser to parse and dereference the spec
  const api = await SwaggerParser.dereference(source) as OpenAPIDocument;
  
  // Detect version and parse accordingly
  if ('openapi' in api && typeof api.openapi === 'string' && api.openapi.startsWith('3.')) {
    return parseOpenAPIV3(api as OpenAPIV3Document);
  } else if ('swagger' in api) {
    return parseSwagger2(api as OpenAPI.Document);
  }
  
  throw new Error('Unsupported OpenAPI version. Supported versions: Swagger 2.0, OpenAPI 3.x');
}

/**
 * Parse OpenAPI 3.x specification
 */
function parseOpenAPIV3(api: OpenAPIV3Document): ParseResult {
  const metadata = extractMetadataV3(api);
  const endpoints = extractEndpointsV3(api);
  const schemas = extractSchemasV3(api);
  const auth = extractAuthV3(api);
  
  return { metadata, endpoints, schemas, auth };
}

/**
 * Parse Swagger 2.0 specification
 */
function parseSwagger2(api: OpenAPI.Document): ParseResult {
  // Convert Swagger 2.0 to a compatible format
  const v3Like = convertSwagger2ToV3Like(api);
  return parseOpenAPIV3(v3Like as OpenAPIV3Document);
}


// Metadata Extraction


function extractMetadataV3(api: OpenAPIV3Document): Partial<ApiMetadata> {
  const info = api.info;
  
  return {
    title: info.title,
    description: info.description,
    version: info.version,
    termsOfService: info.termsOfService,
    contact: info.contact ? {
      name: info.contact.name,
      email: info.contact.email,
      url: info.contact.url,
    } : undefined,
    license: info.license ? {
      name: info.license.name,
      url: info.license.url,
    } : undefined,
    servers: api.servers?.map((server: OpenAPIV3.ServerObject) => ({
      url: server.url,
      description: server.description,
      variables: server.variables ? Object.fromEntries(
        Object.entries(server.variables).map(([key, val]: [string, OpenAPIV3.ServerVariableObject]) => [key, {
          default: val.default,
          enum: val.enum,
          description: val.description,
        }])
      ) : undefined,
    })),
  };
}


// Endpoint Extraction


const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function extractEndpointsV3(api: OpenAPIV3Document): Partial<EndpointSchema>[] {
  const endpoints: Partial<EndpointSchema>[] = [];
  
  if (!api.paths) return endpoints;
  
  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;
    
    // Extract path-level parameters
    const pathParameters = (pathItem as OpenAPIV3.PathItemObject).parameters || [];
    
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;
      
      const endpoint: Partial<EndpointSchema> = {
        method: method.toUpperCase() as EndpointSchema['method'],
        path,
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags,
        parameters: extractParametersV3([...pathParameters, ...(operation.parameters || [])] as OpenAPIV3.ParameterObject[]),
        responses: extractResponsesV3(operation.responses),
        deprecated: operation.deprecated,
      };
      
      // Extract request body
      if (operation.requestBody) {
        const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
        endpoint.requestBody = {
          required: requestBody.required,
          description: requestBody.description,
          content: extractContentV3(requestBody.content),
        };
      }
      
      // Extract security requirements
      if (operation.security) {
        endpoint.security = operation.security;
      }
      
      endpoints.push(endpoint);
    }
  }
  
  return endpoints;
}

function extractParametersV3(params: OpenAPIV3.ParameterObject[]): ParameterSchema[] {
  return params.map(param => ({
    name: param.name,
    in: param.in as ParameterSchema['in'],
    required: param.required || false,
    description: param.description,
    type: getSchemaType(param.schema as OpenAPIV3.SchemaObject),
    schema: convertSchemaV3(param.schema as OpenAPIV3.SchemaObject),
    example: param.example,
    deprecated: param.deprecated,
  }));
}

function extractResponsesV3(responses?: OpenAPIV3.ResponsesObject): ResponseSchema[] {
  if (!responses) return [];
  
  const result: ResponseSchema[] = [];
  
  for (const [statusCode, response] of Object.entries(responses)) {
    const responseObj = response as OpenAPIV3.ResponseObject;
    
    result.push({
      statusCode: statusCode === 'default' ? 'default' : parseInt(statusCode, 10),
      description: responseObj.description,
      content: responseObj.content ? extractContentV3(responseObj.content) : undefined,
      headers: responseObj.headers ? extractHeadersV3(responseObj.headers) : undefined,
    });
  }
  
  return result;
}

function extractContentV3(content: Record<string, OpenAPIV3.MediaTypeObject>): Record<string, { schema?: JsonSchema; example?: unknown }> {
  const result: Record<string, { schema?: JsonSchema; example?: unknown }> = {};
  
  for (const [mediaType, mediaTypeObj] of Object.entries(content)) {
    result[mediaType] = {
      schema: mediaTypeObj.schema ? convertSchemaV3(mediaTypeObj.schema as OpenAPIV3.SchemaObject) : undefined,
      example: mediaTypeObj.example,
    };
  }
  
  return result;
}

function extractHeadersV3(headers: Record<string, OpenAPIV3.HeaderObject | OpenAPIV3.ReferenceObject>): Record<string, { description?: string; schema?: JsonSchema }> {
  const result: Record<string, { description?: string; schema?: JsonSchema }> = {};
  
  for (const [name, header] of Object.entries(headers)) {
    if ('$ref' in header) continue;
    
    result[name] = {
      description: header.description,
      schema: header.schema ? convertSchemaV3(header.schema as OpenAPIV3.SchemaObject) : undefined,
    };
  }
  
  return result;
}


// Schema Extraction


function extractSchemasV3(api: OpenAPIV3Document): Record<string, JsonSchema> {
  const schemas: Record<string, JsonSchema> = {};
  
  const components = api.components;
  if (!components?.schemas) return schemas;
  
  for (const [name, schema] of Object.entries(components.schemas)) {
    schemas[name] = convertSchemaV3(schema as OpenAPIV3.SchemaObject);
  }
  
  return schemas;
}

function convertSchemaV3(schema: OpenAPIV3.SchemaObject | undefined): JsonSchema {
  if (!schema) return {};
  
  const result: JsonSchema = {};
  
  // Basic properties
  if (schema.type) result.type = schema.type;
  if (schema.format) result.format = schema.format;
  if (schema.title) result.title = schema.title;
  if (schema.description) result.description = schema.description;
  if (schema.default !== undefined) result.default = schema.default;
  if (schema.enum) result.enum = schema.enum;
  
  // String constraints
  if (schema.minLength !== undefined) result.minLength = schema.minLength;
  if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
  if (schema.pattern) result.pattern = schema.pattern;
  
  // Number constraints
  if (schema.minimum !== undefined) result.minimum = schema.minimum;
  if (schema.maximum !== undefined) result.maximum = schema.maximum;
  if (schema.exclusiveMinimum !== undefined) {
    result.exclusiveMinimum = typeof schema.exclusiveMinimum === 'boolean' ? undefined : schema.exclusiveMinimum;
  }
  if (schema.exclusiveMaximum !== undefined) {
    result.exclusiveMaximum = typeof schema.exclusiveMaximum === 'boolean' ? undefined : schema.exclusiveMaximum;
  }
  if (schema.multipleOf !== undefined) result.multipleOf = schema.multipleOf;
  
  // Array constraints
  if ('items' in schema && schema.items) {
    result.items = convertSchemaV3(schema.items as OpenAPIV3.SchemaObject);
  }
  if (schema.minItems !== undefined) result.minItems = schema.minItems;
  if (schema.maxItems !== undefined) result.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) result.uniqueItems = schema.uniqueItems;
  
  // Object constraints
  if (schema.properties) {
    result.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      result.properties[key] = convertSchemaV3(val as OpenAPIV3.SchemaObject);
    }
  }
  if (schema.required) result.required = schema.required;
  if (schema.additionalProperties !== undefined) {
    result.additionalProperties = typeof schema.additionalProperties === 'boolean'
      ? schema.additionalProperties
      : convertSchemaV3(schema.additionalProperties as OpenAPIV3.SchemaObject);
  }
  
  // Composition
  if (schema.allOf) result.allOf = schema.allOf.map((s: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => convertSchemaV3(s as OpenAPIV3.SchemaObject));
  if (schema.anyOf) result.anyOf = schema.anyOf.map((s: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => convertSchemaV3(s as OpenAPIV3.SchemaObject));
  if (schema.oneOf) result.oneOf = schema.oneOf.map((s: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => convertSchemaV3(s as OpenAPIV3.SchemaObject));
  if (schema.not) result.not = convertSchemaV3(schema.not as OpenAPIV3.SchemaObject);
  
  // Examples
  if (schema.example !== undefined) result.example = schema.example;
  
  // Nullable
  if (schema.nullable) result.nullable = schema.nullable;
  
  return result;
}

function getSchemaType(schema: OpenAPIV3.SchemaObject | undefined): string {
  if (!schema) return 'unknown';
  if (schema.type) return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (schema.allOf) return 'object';
  if (schema.anyOf) return 'mixed';
  if (schema.oneOf) return 'mixed';
  return 'unknown';
}


// Auth Extraction


function extractAuthV3(api: OpenAPIV3Document): Partial<AuthInfo> {
  const components = api.components;
  if (!components?.securitySchemes) {
    return { schemes: {}, defaultSecurity: api.security };
  }
  
  const schemes: Record<string, SecurityScheme> = {};
  
  for (const [name, scheme] of Object.entries(components.securitySchemes)) {
    const schemeObj = scheme as OpenAPIV3.SecuritySchemeObject;
    
    if (schemeObj.type === 'apiKey') {
      schemes[name] = {
        type: 'apiKey',
        name: schemeObj.name,
        in: schemeObj.in as 'header' | 'query' | 'cookie',
        description: schemeObj.description,
      };
    } else if (schemeObj.type === 'http') {
      schemes[name] = {
        type: 'http',
        scheme: schemeObj.scheme,
        bearerFormat: schemeObj.bearerFormat,
        description: schemeObj.description,
      };
    } else if (schemeObj.type === 'oauth2') {
      const oauth2Scheme = schemeObj as OpenAPIV3.OAuth2SecurityScheme;
      schemes[name] = {
        type: 'oauth2',
        description: schemeObj.description,
        flows: convertOAuthFlows(oauth2Scheme.flows),
      };
    } else if (schemeObj.type === 'openIdConnect') {
      const oidcScheme = schemeObj as OpenAPIV3.OpenIdSecurityScheme;
      schemes[name] = {
        type: 'openIdConnect',
        openIdConnectUrl: oidcScheme.openIdConnectUrl,
        description: schemeObj.description,
      };
    }
  }
  
  return {
    schemes,
    defaultSecurity: api.security,
  };
}

function convertOAuthFlows(flows: OpenAPIV3.OAuth2SecurityScheme['flows']): SecurityScheme['flows'] {
  const result: SecurityScheme['flows'] = {};
  
  if (flows.implicit) {
    result.implicit = convertOAuthFlow(flows.implicit);
  }
  if (flows.password) {
    result.password = convertOAuthFlow(flows.password);
  }
  if (flows.clientCredentials) {
    result.clientCredentials = convertOAuthFlow(flows.clientCredentials);
  }
  if (flows.authorizationCode) {
    result.authorizationCode = convertOAuthFlow(flows.authorizationCode);
  }
  
  return result;
}

function convertOAuthFlow(flow: OpenAPIV3.OAuth2SecurityScheme['flows']['implicit'] | OpenAPIV3.OAuth2SecurityScheme['flows']['password'] | OpenAPIV3.OAuth2SecurityScheme['flows']['clientCredentials'] | OpenAPIV3.OAuth2SecurityScheme['flows']['authorizationCode']): OAuthFlow | undefined {
  if (!flow) return undefined;
  
  return {
    authorizationUrl: 'authorizationUrl' in flow ? flow.authorizationUrl : undefined,
    tokenUrl: 'tokenUrl' in flow ? flow.tokenUrl : undefined,
    refreshUrl: flow.refreshUrl,
    scopes: flow.scopes,
  };
}


// Swagger 2.0 Conversion


function convertSwagger2ToV3Like(api: OpenAPI.Document): Partial<OpenAPIV3Document> {
  const swagger2 = api as {
    swagger: string;
    info: { title: string; version: string; description?: string };
    host?: string;
    basePath?: string;
    schemes?: string[];
    paths?: Record<string, unknown>;
    definitions?: Record<string, unknown>;
    securityDefinitions?: Record<string, unknown>;
    security?: Array<Record<string, string[]>>;
  };
  
  // Build servers from host/basePath/schemes
  const servers: OpenAPIV3.ServerObject[] = [];
  if (swagger2.host) {
    const schemes = swagger2.schemes || ['https'];
    for (const scheme of schemes) {
      servers.push({
        url: `${scheme}://${swagger2.host}${swagger2.basePath || ''}`,
      });
    }
  }
  
  return {
    openapi: '3.0.0',
    info: swagger2.info as OpenAPIV3.InfoObject,
    servers,
    paths: swagger2.paths as OpenAPIV3.PathsObject,
    components: {
      schemas: swagger2.definitions as Record<string, OpenAPIV3.SchemaObject>,
      securitySchemes: convertSwagger2Security(swagger2.securityDefinitions),
    },
    security: swagger2.security,
  };
}

function convertSwagger2Security(securityDefinitions?: Record<string, unknown>): Record<string, OpenAPIV3.SecuritySchemeObject> | undefined {
  if (!securityDefinitions) return undefined;
  
  const result: Record<string, OpenAPIV3.SecuritySchemeObject> = {};
  
  for (const [name, def] of Object.entries(securityDefinitions)) {
    const secDef = def as { type: string; name?: string; in?: string; flow?: string; authorizationUrl?: string; tokenUrl?: string; scopes?: Record<string, string> };
    
    if (secDef.type === 'apiKey') {
      result[name] = {
        type: 'apiKey',
        name: secDef.name || '',
        in: (secDef.in || 'header') as 'header' | 'query' | 'cookie',
      };
    } else if (secDef.type === 'basic') {
      result[name] = {
        type: 'http',
        scheme: 'basic',
      };
    } else if (secDef.type === 'oauth2') {
      result[name] = {
        type: 'oauth2',
        flows: {
          [secDef.flow === 'implicit' ? 'implicit' : secDef.flow === 'password' ? 'password' : secDef.flow === 'application' ? 'clientCredentials' : 'authorizationCode']: {
            authorizationUrl: secDef.authorizationUrl || '',
            tokenUrl: secDef.tokenUrl || '',
            scopes: secDef.scopes || {},
          },
        },
      } as OpenAPIV3.OAuth2SecurityScheme;
    }
  }
  
  return result;
}


// Utility Functions


/**
 * Check if a file is likely an OpenAPI spec
 */
export function isOpenAPIFile(filePath: string): boolean {
  const ext = filePath.toLowerCase();
  return ext.endsWith('.yaml') || 
         ext.endsWith('.yml') || 
         ext.endsWith('.json') ||
         ext.includes('openapi') ||
         ext.includes('swagger');
}

/**
 * Check if content looks like an OpenAPI spec
 */
export function isOpenAPIContent(content: string): boolean {
  // Check for common OpenAPI markers
  return content.includes('openapi:') || 
         content.includes('"openapi"') ||
         content.includes('swagger:') ||
         content.includes('"swagger"');
}
