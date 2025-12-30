/**
 * Example: Using doc-mcp with Express
 * 
 * Run: npx ts-node examples/express-example.ts
 */

import express from 'express';
import docmcp from '../src';

async function main() {
  const app = express();
  
  // Initialize doc-mcp with OpenAPI documentation
  const mcp = await docmcp(app, {
    docs: './examples/petstore.yaml',
    basePath: '/mcp',
    verbose: true,
    metadata: {
      title: 'Pet Store API',
      description: 'A sample pet store API with MCP endpoints',
    },
  });

  // Add a simple health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Access schema programmatically
  const schema = mcp.getSchema();
  console.log(`Loaded ${schema.endpoints.length} endpoints`);

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`\nMCP endpoints:`);
    console.log(`  GET http://localhost:${PORT}/mcp/describe`);
    console.log(`  GET http://localhost:${PORT}/mcp/schemas`);
    console.log(`  GET http://localhost:${PORT}/mcp/endpoints`);
    console.log(`  GET http://localhost:${PORT}/mcp/auth`);
  });
}

main().catch(console.error);
