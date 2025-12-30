/**
 * Example: Standalone MCP Server
 * 
 * Run: npx ts-node examples/standalone-example.ts
 */

import docmcp from '../src';

async function main() {
  const mcp = await docmcp({
    docs: './examples/petstore.yaml',
    basePath: '/mcp',
    standalone: true,
    port: 3000,
    host: '0.0.0.0',
    verbose: true,
  });

  // Start the server
  await mcp.listen();

  // The schema is accessible
  const schema = mcp.getSchema();
  console.log(`\nAPI: ${schema.metadata.title} v${schema.metadata.version}`);
  console.log(`Endpoints: ${schema.endpoints.length}`);
  console.log(`Schemas: ${Object.keys(schema.schemas).length}`);
}

main().catch(console.error);
