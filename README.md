# doc-mcp

**Make your documentation queryable by AI assistants like Copilot and Cursor.**

Turn your docs, APIs, and source code into an MCP server in 3 lines of code. No protocol knowledge required.

## Why Use This?

If you have a **UI library**, **API**, or **SDK**, developers can now ask AI:
- _"Show me the Button component code"_
- _"How do I use the Modal?"_
- _"Get the useAuth hook example"_

Instead of searching through docs, **AI fetches the exact code** they need from your MCP server.

## What It Does

```typescript
// Your docs + code
docs/
  ├── button.md          // Markdown docs
  ├── modal.md
src/
  ├── components/
  │   └── Button.tsx     // Source code
  └── hooks/
      └── useAuth.ts

// Becomes queryable by AI
👇
await docmcp({ docs: ['./docs/**/*.md', './src/**/*.{ts,tsx}'] });
// ✅ Copilot can now query your docs + code!
```

## Features

- **AI-Queryable** - Copilot/Cursor can search your docs and code
- **Multiple Formats** - Markdown, OpenAPI, TypeScript/JavaScript
- **Smart Parsing** - Extracts functions, types, JSDoc, code examples
- **Glob Patterns** - Scan entire directories automatically
- **Zero Config** - 3 lines to get started
- **Framework Agnostic** - Express, Fastify, or standalone

## Installation

### Full Package (All Parsers)
```bash
npm install doc-mcpify
```

### Lightweight Options (Install Only What You Need)
```bash
# For Markdown/MDX only
npm install doc-mcpify  # Then use: import { docmcp } from 'doc-mcpify/md'

# For TypeScript/TSX only (.ts, .tsx files)
npm install doc-mcpify  # Then use: import { docmcp } from 'doc-mcpify/ts'

# For JavaScript/JSX only (.js, .jsx files)
npm install doc-mcpify  # Then use: import { docmcp } from 'doc-mcpify/js'

# For OpenAPI/Swagger only
npm install doc-mcpify  # Then use: import { docmcp } from 'doc-mcpify/openapi'

# For MDX specifically (includes Markdown)
npm install doc-mcpify  # Then use: import { docmcp } from 'doc-mcpify/mdx'
```

## Quick Start (3 Steps)

### Step 1: Install

```bash
npm install doc-mcpify
```

### Step 2: Create MCP Server

Create `mcp-server.mjs` in your project:

**Option A: Full Package**
```javascript
import { docmcp } from 'doc-mcpify';

await docmcp({
  docs: [
    './docs/**/*.md',           // All markdown files
    './src/components/**/*.tsx', // React components
    './src/hooks/**/*.ts',       // Custom hooks
  ],
  standalone: true,
  port: 3001,
});

console.log('✅ MCP Server running on http://localhost:3001');
```

**Option B: Lightweight (Markdown Only)**
```javascript
import { docmcp } from 'doc-mcpify/md';  // ✨ Only installs markdown parser

await docmcp({
  docs: ['./docs/**/*.md'],
  standalone: true,
  port: 3001,
});
```

**Option C: TypeScript/TSX Only**
```javascript
import { docmcp } from 'doc-mcpify/ts';  // ✨ Supports .ts AND .tsx files

await docmcp({
  docs: ['./src/**/*.{ts,tsx}'],
  standalone: true,
  port: 3001,
});
```

**Option D: React Components (JSX/TSX)**
```javascript
import { docmcp } from 'doc-mcpify/ts';  // ✨ Parses React components

await docmcp({
  docs: ['./components/**/*.{jsx,tsx}'],
  standalone: true,
  port: 3001,
});
```

### Step 3: Connect to VS Code

Add to your `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "my-docs": {
      "command": "node",
      "args": ["./mcp-server.mjs"]
    }
  }
}
```

**Done!** Reload VS Code and Copilot can now query your docs.

## Try It

Ask Copilot:
- _"Show me how to use the Button component"_
- _"Get the Modal props"_
-  What Gets Parsed?

### From Markdown Files

```markdown
# Button Component

## Usage
\`\`\`tsx
<Button variant="primary">Click me</Button>
\`\`\`
```

**Extracted:**
- Component name
- Code examples
- Usage instructions
- KIntegration Options

### Option 1: Standalone (Recommended)

Perfect for documentation sites:

```javascript
import docmcp from 'doc-mcpify';

await docmcp({
  docs: ['./docs/**/*.md', './src/**/*.tsx'],
  standalone: true,
  port: 3001,
});
```

### Option 2: With Express

Add to existing Express app:

```javascript
import express from 'express';
import { docmcp } from 'doc-mcpify';  // Or use /md, /ts, /openapi

const app = express();

await docmcp(app, {
  docs: './docs/**/*.md',
  basePath: '/mcp',
});

app.listen(3000);
```

### Option 3: With Fastify

```javascript
import Fastify from 'fastify';
import { docmcp } from 'doc-mcpify';  // Or use /md, /ts, /openapi

const fastify = Fastify();

await docmcp(fastify, {
  docs: './docs/**/*.md',
});

fastify.listen({ port: 3000 });
```

## MCP Endpoints (Auto-Created)

| Endpoint | What Copilot Gets |
|----------|-------------------|
| `/mcp/describe` | Your API/library overview |
| `/mcp/resources` | **All your docs + code examples** ⭐ |
| `/mcp/endpoints` | API endpoint list (if OpenAPI) |
| `/mcp/schemas` | Type definition
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
}
```

**Extracted:**
- Exported functions/components
- JSDoc comments
- TypeScript interfaces/types
- Function signatures

### From OpenAPI Specs

```yaml
paths:
  /users/{id}:
    get:
      summary: Get user by ID
```

**Extracted:**
- API endpoints
- Parameters
- Request/response schemas
- Authentication requirements-mcp validate ./openapi.yaml

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
  }## Common Use Cases

### UI Library Documentation

```javascript
// Lightweight: Only markdown parser
import { docmcp } from 'doc-mcpify/md';

await docmcp({
  docs: ['./docs/**/*.md'],
  standalone: true,
  port: 3001,
});
```

```javascript
// Full: Markdown + TypeScript components
import { docmcp } from 'doc-mcpify';

await docmcp({
  docs: [
    './docs/**/*.md',              // Markdown docs
    './src/components/**/*.tsx',   // Component code
    './src/hooks/**/*.ts',         // Custom hooks
  ],
  standalone: true,
  port: 3001,
  metadata: {
    title: 'My UI Library',
    description: 'Reusable React components',
  },
});
```

### API Documentation

```javascript
// OpenAPI only (lightweight)
import { docmcp } from 'doc-mcpify/openapi';

await docmcp({
  docs: ['./openapi.yaml'],
  standalone: true,
  port: 3001,
});
```

```javascript
// OpenAPI + Guides
import { docmcp } from 'doc-mcpify';

await docmcp({
  docs: [
    './openapi.yaml',    // API spec
    './guides/*.md',     // User guides
  ],
  standalone: true,
  port: 3001,
});
```

### SDK Documentation

```javascript
// TypeScript SDK only
import { docmcp } from 'doc-mcpify/ts';

await docmcp({
  docs: [
    './README.md',
    './docs/**/*.md',
    './src/**/*.ts',     // All TypeScript files
  ],
  standalone: true, {
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
   Testing Your MCP Server

### 1. Start the server

```bash
node mcp-server.mjs
```

### 2. Test in browser

```
http://localhost:3001/mcp/resources?search=button
```

Should return your Button docs/code.

### 3. Connect to VS Code

Add to `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "my-docs": {
      "command": "node",
      "args": ["./mcp-server.mjs"]
    }
  }
}
```

Reload VS Code (Ctrl+Shift+P → "Reload Window")

### 4. Query with Copilot

Ask: _"Show me the Button component from my-docs"_

If it works, Copilot will return your Button code! 🎉 };
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
awaAdvanced Configuration

```javascript
await docmcp({
  docs: [
    './docs/**/*.md',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  
  // Base path for endpoints
  basePath: '/mcp',
  
  // Filter what gets exposed
  visibility: {
    include: ['./src/components/**/*'],
    exclude: ['**/*.test.*', '**/__tests__/**'],
  },
  
  // Metadata override
  metadata: {
    title: 'My Library',
    version: '2.0.0',
    description: 'Library documentation',
  },
  
  // Enable logging
  verbose: true,
  
  // Standalone server options
  standalone: true,
  port: 3001,
  host: '0.0.0.0',
});
```

## Supported File Types

| Type | Extensions | What Gets Extracted | Import From |
|------|-----------|---------------------|-------------|
| **Markdown** | `.md`, `.mdx` | Code blocks, headings, content | `doc-mcpify/md` or `doc-mcpify/mdx` |
| **TypeScript** | `.ts`, `.tsx` | Exports, JSDoc, types, interfaces | `doc-mcpify/ts` |
| **JavaScript** | `.js`, `.jsx`, `.mjs` | Exports, JSDoc, functions | `doc-mcpify/js` |
| **OpenAPI** | `.yaml`, `.yml`, `.json` | Endpoints, schemas, auth | `doc-mcpify/openapi` |

> **Note:** Using subpath imports (like `/ts`, `/md`) only installs the dependencies needed for that parser, keeping your `node_modules` lightweight! // Only include certain paths
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

```Real-World Examples

### Example 1: Component Library

```javascript
// mcp-server.mjs
import docmcp from 'doc-mcpify';

await docmcp({
  docs: [
    './README.md',
    './docs/**/*.md',
    './src/components/**/*.tsx',
    './src/hooks/**/*.ts',
  ],
  metadata: {
    title: 'Acme UI Components',
    description: 'React component library for Acme Corp',
  },
  standalone: true,
  port: 3001,
});
```

**Copilot can now answer:**
- "Show Acme Button component"
- "How to use Acme Modal?"
- "Get Acme useTheme hook code"

### Example 2: REST API

```javascript
import docmcp from 'doc-mcpify';

await docmcp({
  docs: [
    './openapi.yaml',
    './docs/getting-started.md',
    './docs/authentication.md',
  ],
  standalone: true,
  port: 3001,
});
```

**Copilot can query:**
- API endpoints
- Authentication flow
- Request/response examples

## Troubleshooting

### MCP server not connecting?

1. Check the server is running: `node mcp-server.mjs`
2. Verify port is correct in VS Code settings
3. Try reloading VS Code window
4. Check for errors in terminal

### Copilot not finding my docs?

1. Test endpoint: `http://localhost:3001/mcp/resources`
2. Should return JSON with your docs
3. Try searching: `http://localhost:3001/mcp/resources?search=yourterm`
4. Check file paths in docs array are correct

### TypeScript files not parsing?

- Make sure file matches glob pattern
- Check syntax is valid (run `tsc --noEmit`)
- Enable `verbose: true` to see parsing logsge:
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

## API Reference

Full TypeScript types exported:

```typescript
import type {
  DocMcpConfig,
  DocMcpInstance,
  DocResource,
  CodeExample,
  NormalizedSchema,
} from 'doc-mcpify';
```

See [examples/](./examples/) for more usage patterns.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT

---

**Made with ❤️ for developers who want AI to understand their docs**s API uses Bearer token authentication.
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
