# doc-mcp

A framework that allows API providers to expose a fully compliant MCP (Machine-Consumable Protocol) server without writing MCP-specific code. Install, configure, enable — no protocol knowledge required.

## Features

- 🚀 **Zero Protocol Knowledge Required** - Just point to your docs, get an MCP server
- 📄 **Multiple Doc Formats** - OpenAPI (2.0/3.x), Markdown, or mix them
- 🔌 **Framework Agnostic** - Works with Express, Fastify, or standalone
- 🎯 **Type Safe** - Full TypeScript support with comprehensive types
- 🔧 **Configurable** - Control visibility, auth, and metadata
- 📦 **CLI Included** - Quick server startup from command line

## Installation

```bash
npm install doc-mcp
```

## Quick Start

### With Express

```typescript
import express from 'express';
import docmcp from 'doc-mcp';

const app = express();

await docmcp(app, {
  docs: './openapi.yaml',
  basePath: '/mcp'
});

app.listen(3000, () => {
  console.log('Server with MCP endpoints running on http://localhost:3000');
});
```

### With Fastify

```typescript
import Fastify from 'fastify';
import docmcp from 'doc-mcp';

const fastify = Fastify();

await docmcp(fastify, {
  docs: './openapi.yaml',
  basePath: '/mcp'
});

fastify.listen({ port: 3000 });
```

### Standalone Server

```typescript
import docmcp from 'doc-mcp';

const mcp = await docmcp({
  docs: './openapi.yaml',
  basePath: '/mcp',
  standalone: true,
  port: 3000
});

await mcp.listen();
```

### CLI

```bash
# Start a server
doc-mcp serve ./openapi.yaml --port 3000

# Validate documentation
doc-mcp validate ./openapi.yaml

# Inspect parsed documentation
doc-mcp inspect ./openapi.yaml
```

## MCP Endpoints

Once mounted, doc-mcp exposes the following endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp/describe` | GET | High-level API description, metadata, versioning |
| `/mcp/schemas` | GET | Normalized API schemas (OpenAPI-like JSON) |
| `/mcp/endpoints` | GET | List of available API endpoints with params |
| `/mcp/auth` | GET | Authentication requirements and headers |

### Example Responses

#### GET /mcp/describe

```json
{
  "name": "My API",
  "description": "A sample API",
  "version": "1.0.0",
  "servers": [
    { "url": "https://api.example.com" }
  ],
  "documentation": {
    "type": "openapi",
    "sources": ["./openapi.yaml"]
  },
  "generatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /mcp/endpoints

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/users/{id}",
      "operationId": "getUser",
      "summary": "Get a user by ID",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "type": "string"
        }
      ],
      "responses": [
        { "statusCode": 200, "description": "Successful response" }
      ]
    }
  ],
  "count": 1,
  "tags": ["users"]
}
```

## Configuration

```typescript
interface DocMcpConfig {
  // Required: Path or URL to documentation
  docs: string | string[];

  // Base path for MCP endpoints (default: '/mcp')
  basePath?: string;

  // Authentication configuration
  auth?: {
    type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2';
    name?: string;        // Header/param name for apiKey
    in?: 'header' | 'query' | 'cookie';
    description?: string;
    oauth2?: {
      authorizationUrl?: string;
      tokenUrl?: string;
      scopes?: Record<string, string>;
    };
  };

  // Visibility control
  visibility?: {
    include?: string[];     // Glob patterns to include
    exclude?: string[];     // Glob patterns to exclude
    exposeInternal?: boolean;
  };

  // Metadata overrides
  metadata?: {
    title?: string;
    description?: string;
    version?: string;
    contact?: { name?: string; email?: string; url?: string };
    license?: { name?: string; url?: string };
    servers?: Array<{ url: string; description?: string }>;
  };

  // Enable verbose logging
  verbose?: boolean;

  // Custom parsers
  parsers?: CustomParser[];
}
```

### Environment Variables

Configuration can also be set via environment variables:

- `DOC_MCP_DOCS` - Path to documentation
- `DOC_MCP_BASE_PATH` - Base path for endpoints
- `DOC_MCP_VERBOSE` - Enable verbose logging (`true` or `1`)

## Multiple Documentation Sources

Combine multiple documentation files:

```typescript
await docmcp(app, {
  docs: [
    './openapi.yaml',    // Main API spec
    './webhooks.md',     // Webhook documentation
    './guides.md'        // Additional guides
  ]
});
```

## Filtering Endpoints

Control which endpoints are exposed:

```typescript
await docmcp(app, {
  docs: './openapi.yaml',
  visibility: {
    // Only include certain paths
    include: ['/api/v1/*', '/public/*'],
    
    // Exclude internal endpoints
    exclude: ['/internal/*', '*/admin/*'],
    
    // Don't expose internal/private endpoints
    exposeInternal: false
  }
});
```

## Query Parameters

The `/mcp/endpoints` endpoint supports filtering:

```
GET /mcp/endpoints?tag=users         # Filter by tag
GET /mcp/endpoints?method=POST       # Filter by HTTP method
GET /mcp/endpoints?path=/users       # Filter by path substring
GET /mcp/endpoints?deprecated=false  # Exclude deprecated
```

## Programmatic Access

Access the parsed schema programmatically:

```typescript
const mcp = await docmcp(app, { docs: './openapi.yaml' });

// Get the normalized schema
const schema = mcp.getSchema();
console.log(schema.endpoints.length);

// Get handlers for custom routing
const handlers = mcp.getHandlers();
const description = handlers.describe();

// Reload documentation
await mcp.reload();
```

## Custom Parsers

Add support for additional documentation formats:

```typescript
await docmcp(app, {
  docs: './custom-format.xml',
  parsers: [{
    extensions: ['.xml'],
    parse: async (content, filePath) => {
      // Parse your custom format
      return {
        metadata: { title: 'My API' },
        endpoints: [...],
        schemas: {},
        auth: {}
      };
    }
  }]
});
```

## Express Middleware

Use as middleware instead of direct mounting:

```typescript
import { createExpressMiddleware, parseAllDocumentation, normalizeSchema, resolveConfig } from 'doc-mcp';

const config = resolveConfig({ docs: './openapi.yaml' });
const parseResult = await parseAllDocumentation(config.docs, config, logger);
const schema = normalizeSchema(parseResult, config, config.docs, logger);

app.use(createExpressMiddleware(schema, config));
```

## Fastify Plugin

Use as a Fastify plugin:

```typescript
import { createFastifyPlugin, parseAllDocumentation, normalizeSchema, resolveConfig } from 'doc-mcp';

const config = resolveConfig({ docs: './openapi.yaml' });
const parseResult = await parseAllDocumentation(config.docs, config, logger);
const schema = normalizeSchema(parseResult, config, config.docs, logger);

fastify.register(createFastifyPlugin(schema, config));
```

## CLI Reference

```
doc-mcp - MCP Server for API Documentation

Usage:
  doc-mcp serve <docs> [options]   Start an MCP server
  doc-mcp validate <docs>          Validate documentation files
  doc-mcp inspect <docs>           Inspect and display parsed documentation
  doc-mcp --help                   Show this help message
  doc-mcp --version                Show version

Options:
  --port, -p <port>       Port to listen on (default: 3000)
  --host, -h <host>       Host to bind to (default: 0.0.0.0)
  --base-path, -b <path>  Base path for MCP endpoints (default: /mcp)
  --verbose, -v           Enable verbose logging
```

## Supported Documentation Formats

### OpenAPI

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0

Files with `.yaml`, `.yml`, or `.json` extensions containing OpenAPI specs are automatically detected.

### Markdown

Markdown files are parsed for API documentation patterns:

```markdown
# My API

Version: 1.0.0
Base URL: https://api.example.com

## Authentication

This API uses Bearer token authentication.
Add the Authorization header: `Authorization: Bearer your-token`

## Endpoints

### GET /users/{id}

Get a user by ID.

Parameters:
- `id` (string) - The user ID

Response 200:
- User object
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  DocMcpConfig,
  DocMcpInstance,
  NormalizedSchema,
  EndpointSchema,
  McpDescribeResponse,
  McpEndpointsResponse,
} from 'doc-mcp';
```

## License

MIT
