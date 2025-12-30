/**
 * Example: Using doc-mcp with Fastify
 * 
 * Run: npx ts-node examples/fastify-example.ts
 */

import Fastify from 'fastify';
import docmcp from '../src';

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // Initialize doc-mcp
  await docmcp(fastify, {
    docs: './examples/petstore.yaml',
    basePath: '/mcp',
    visibility: {
      // Only expose pet endpoints
      include: ['/pets*'],
    },
  });

  // Add custom routes
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Start server
  const PORT = parseInt(process.env.PORT || '3000', 10);
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  
  console.log(`Server running on http://localhost:${PORT}`);
}

main().catch(console.error);
