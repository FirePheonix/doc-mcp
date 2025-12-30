import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/doc-mcp': 'src/bin/doc-mcp.ts',
    md: 'src/md.ts',
    mdx: 'src/mdx.ts',
    js: 'src/js.ts',
    ts: 'src/ts.ts',
    openapi: 'src/openapi.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['express', 'fastify'],
  banner: {
    js: '/* doc-mcp - MCP Server Framework */',
  },
});
