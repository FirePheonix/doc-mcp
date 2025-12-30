# Getting Started with doc-mcp

Complete guide for developers who want to add MCP documentation endpoints to their API.

## Installation

```bash
npm install doc-mcp
```

## Quick Start

### 1. With Express (Most Common)

If you have an existing Express API:

```typescript
// server.ts or app.ts or index.ts
import express from 'express';
import docmcp from 'doc-mcp';

const app = express();

// Your existing API routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  res.json({ created: true });
});

// Add MCP documentation endpoints
await docmcp(app, {
  docs: './openapi.yaml',  // Path to your OpenAPI spec
  basePath: '/mcp'         // Where MCP endpoints are mounted
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('MCP endpoints at http://localhost:3000/mcp/*');
});
```

**File structure:**
```
your-project/
├── src/
│   └── server.ts          ← Add docmcp() here
├── openapi.yaml           ← Your API documentation
├── package.json
└── node_modules/
```

### 2. With Fastify

```typescript
// server.ts
import Fastify from 'fastify';
import docmcp from 'doc-mcp';

const fastify = Fastify({ logger: true });

// Your existing routes
fastify.get('/api/products', async (request, reply) => {
  return { products: [] };
});

// Add MCP documentation endpoints
await docmcp(fastify, {
  docs: './openapi.yaml',
  basePath: '/mcp'
});

// Start server
await fastify.listen({ port: 3000 });
```

### 3. Standalone Server (No Existing API)

If you just want to serve API documentation:

```typescript
// mcp-server.ts
import docmcp from 'doc-mcp';

const server = await docmcp({
  docs: './openapi.yaml',
  basePath: '/mcp',
  standalone: true,
  port: 3000,
  host: '0.0.0.0'
});

await server.listen();
console.log('MCP documentation server running on http://localhost:3000');
```

## Step-by-Step Integration

### Step 1: Install Dependencies

```bash
# Install doc-mcp
npm install doc-mcp

# If using Express (and you don't have it)
npm install express
npm install -D @types/express

# If using Fastify (and you don't have it)
npm install fastify
```

### Step 2: Prepare Your Documentation

You need one of:

**Option A: OpenAPI/Swagger file**
```
your-project/
├── openapi.yaml    ← or swagger.json, api-spec.yaml, etc.
└── src/
```

**Option B: Markdown documentation**
```
your-project/
├── docs/
│   └── api.md      ← API documentation in markdown
└── src/
```

**Option C: Multiple sources**
```typescript
await docmcp(app, {
  docs: [
    './openapi.yaml',
    './docs/webhooks.md',
    './docs/advanced.md'
  ]
});
```

### Step 3: Find Your Main Server File

This is where you initialize your Express or Fastify app. Common locations:

- `src/server.ts`
- `src/app.ts`
- `src/index.ts`
- `server.js`
- `index.js`

### Step 4: Add doc-mcp

**Before:**
```typescript
// src/server.ts
import express from 'express';
const app = express();

// Your routes
app.get('/users', getUsers);
app.post('/users', createUser);

app.listen(3000);
```

**After:**
```typescript
// src/server.ts
import express from 'express';
import docmcp from 'doc-mcp';  // ← Add this

const app = express();

// Your routes
app.get('/users', getUsers);
app.post('/users', createUser);

// Add MCP endpoints  ← Add this
await docmcp(app, {
  docs: './openapi.yaml',
  basePath: '/mcp'
});

app.listen(3000);
```

### Step 5: Update Your Code to Use async/await

If your server file doesn't use async/await:

**Before:**
```typescript
const app = express();
// ... routes ...
app.listen(3000);
```

**After:**
```typescript
async function startServer() {
  const app = express();
  
  // ... routes ...
  
  // Add MCP (needs await)
  await docmcp(app, {
    docs: './openapi.yaml',
    basePath: '/mcp'
  });
  
  app.listen(3000);
}

startServer().catch(console.error);
```

### Step 6: Test the Endpoints

Start your server and visit:

```bash
# Describe endpoint
curl http://localhost:3000/mcp/describe

# List all endpoints
curl http://localhost:3000/mcp/endpoints

# Get schemas
curl http://localhost:3000/mcp/schemas

# Auth info
curl http://localhost:3000/mcp/auth
```

## Real-World Examples

### Example 1: E-commerce API

```typescript
// src/server.ts
import express from 'express';
import docmcp from 'doc-mcp';

const app = express();
app.use(express.json());

// Your business logic routes
app.get('/products', listProducts);
app.get('/products/:id', getProduct);
app.post('/orders', createOrder);
app.get('/orders/:id', getOrder);

// Add MCP documentation
await docmcp(app, {
  docs: './openapi.yaml',
  basePath: '/mcp',
  metadata: {
    title: 'E-commerce API',
    description: 'Shop API with products and orders',
    version: '2.0.0'
  }
});

app.listen(3000);
```

### Example 2: With Authentication

```typescript
import docmcp from 'doc-mcp';

await docmcp(app, {
  docs: './openapi.yaml',
  basePath: '/mcp',
  auth: {
    type: 'bearer',
    description: 'Use JWT token in Authorization header'
  }
});
```

### Example 3: Only Expose Certain Endpoints

```typescript
await docmcp(app, {
  docs: './openapi.yaml',
  basePath: '/mcp',
  visibility: {
    include: ['/api/public/*'],      // Only public endpoints
    exclude: ['/api/admin/*'],       // Hide admin endpoints
    exposeInternal: false
  }
});
```

### Example 4: Multiple Environments

```typescript
// src/server.ts
import docmcp from 'doc-mcp';

const app = express();

// ... your routes ...

// Only enable MCP in development
if (process.env.NODE_ENV === 'development') {
  await docmcp(app, {
    docs: './openapi.yaml',
    basePath: '/mcp',
    verbose: true
  });
}

app.listen(3000);
```

### Example 5: TypeScript with Types

```typescript
import express, { Express } from 'express';
import docmcp, { DocMcpInstance } from 'doc-mcp';

async function setupServer(): Promise<Express> {
  const app = express();
  
  // Your routes
  app.get('/health', (req, res) => res.json({ ok: true }));
  
  // Add MCP with full type safety
  const mcp: DocMcpInstance = await docmcp(app, {
    docs: './openapi.yaml',
    basePath: '/mcp',
    verbose: true
  });
  
  // Access the schema programmatically
  const schema = mcp.getSchema();
  console.log(`Loaded ${schema.endpoints.length} endpoints`);
  
  return app;
}

setupServer().then(app => {
  app.listen(3000, () => {
    console.log('Server ready');
  });
});
```

## Configuration Reference

```typescript
await docmcp(app, {
  // Required: Path to documentation
  docs: './openapi.yaml',  // or array: ['./api.yaml', './docs.md']
  
  // Optional: Base path for MCP endpoints
  basePath: '/mcp',  // default: '/mcp'
  
  // Optional: Authentication info
  auth: {
    type: 'bearer',  // or 'apiKey', 'basic', 'oauth2', 'none'
    description: 'JWT token required'
  },
  
  // Optional: Control endpoint visibility
  visibility: {
    include: ['/public/*'],
    exclude: ['/admin/*']
  },
  
  // Optional: Override metadata
  metadata: {
    title: 'My API',
    version: '1.0.0',
    description: 'Custom description'
  },
  
  // Optional: Enable debug logging
  verbose: true
});
```

## Common Issues

### Issue: "Cannot find module 'doc-mcp'"

**Solution:** Install the package
```bash
npm install doc-mcp
```

### Issue: "docs configuration is required"

**Solution:** Provide path to your API documentation
```typescript
await docmcp(app, {
  docs: './openapi.yaml'  // ← Must provide this
});
```

### Issue: "Top-level await is not available"

**Solution:** Wrap in async function
```typescript
// Instead of:
await docmcp(app, { docs: './openapi.yaml' });

// Use:
async function start() {
  await docmcp(app, { docs: './openapi.yaml' });
  app.listen(3000);
}
start();
```

### Issue: Routes return 404

**Solution:** Ensure you're calling the right path
```typescript
// If basePath is '/mcp', endpoints are:
// http://localhost:3000/mcp/describe
// http://localhost:3000/mcp/endpoints
// NOT: http://localhost:3000/describe
```

## Using the CLI

Instead of integrating into your app, use the CLI:

```bash
# Serve documentation
npx doc-mcp serve ./openapi.yaml --port 3000

# Validate documentation
npx doc-mcp validate ./openapi.yaml

# Inspect documentation
npx doc-mcp inspect ./openapi.yaml
```

## Next Steps

1. ✅ Install doc-mcp
2. ✅ Add it to your server file
3. ✅ Point it to your OpenAPI spec
4. ✅ Test the MCP endpoints
5. 🚀 Deploy your API with MCP support

Now AI agents and tools can automatically discover your API structure!

## Need Help?

- Check the [README.md](./README.md) for more examples
- See [examples/](./examples/) for complete working examples
- Open an issue on GitHub for bugs or questions
