#!/usr/bin/env node

/**
 * doc-mcp CLI
 * 
 * Command-line interface for running a standalone MCP server.
 * 
 * Usage:
 *   doc-mcp serve ./openapi.yaml --port 3000
 *   doc-mcp validate ./openapi.yaml
 *   doc-mcp inspect ./openapi.yaml
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import docmcp from '../index';
import { parseAllDocumentation } from '../parsers';
import { normalizeSchema } from '../normalizers';
import { resolveConfig, createLogger } from '../core';

// CLI Configuration

const VERSION = '1.0.0';

const HELP_TEXT = `
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

Examples:
  doc-mcp serve ./openapi.yaml
  doc-mcp serve ./openapi.yaml --port 8080
  doc-mcp serve ./api.md ./openapi.yaml --verbose
  doc-mcp validate ./openapi.yaml
  doc-mcp inspect ./openapi.yaml
`;

// Argument Parsing

interface CliOptions {
  port: number;
  host: string;
  basePath: string;
  verbose: boolean;
}

function parseCliArgs(): {
  command: string;
  docs: string[];
  options: CliOptions;
} {
  try {
    const { values, positionals } = parseArgs({
      options: {
        port: { type: 'string', short: 'p', default: '3000' },
        host: { type: 'string', short: 'h', default: '0.0.0.0' },
        'base-path': { type: 'string', short: 'b', default: '/mcp' },
        verbose: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: true,
    });

    // Handle --help and --version
    if (values.help) {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    if (values.version) {
      console.log(`doc-mcp version ${VERSION}`);
      process.exit(0);
    }

    // Extract command and docs
    const command = positionals[0] || 'serve';
    const docs = positionals.slice(1);

    return {
      command,
      docs,
      options: {
        port: parseInt(values.port as string, 10),
        host: values.host as string,
        basePath: values['base-path'] as string,
        verbose: values.verbose as boolean,
      },
    };
  } catch (error) {
    console.error('Error parsing arguments:', error instanceof Error ? error.message : error);
    console.log(HELP_TEXT);
    process.exit(1);
  }
}

// Commands

/**
 * Serve command - Start an MCP server
 */
async function commandServe(docs: string[], options: CliOptions): Promise<void> {
  if (docs.length === 0) {
    console.error('Error: No documentation files specified');
    console.log('Usage: doc-mcp serve <docs> [options]');
    process.exit(1);
  }

  // Resolve paths
  const resolvedDocs = docs.map(d => path.resolve(process.cwd(), d));

  // Validate files exist
  for (const doc of resolvedDocs) {
    if (!fs.existsSync(doc)) {
      console.error(`Error: File not found: ${doc}`);
      process.exit(1);
    }
  }

  console.log('Starting doc-mcp server...');
  console.log(`Documentation: ${resolvedDocs.join(', ')}`);
  console.log(`Port: ${options.port}`);
  console.log(`Base path: ${options.basePath}`);

  try {
    const mcp = await docmcp({
      docs: resolvedDocs,
      basePath: options.basePath,
      verbose: options.verbose,
      standalone: true,
      port: options.port,
      host: options.host,
    });

    await mcp.listen();

    // Display available endpoints
    console.log('\nMCP endpoints available:');
    console.log(`  GET http://${options.host}:${options.port}${options.basePath}/describe`);
    console.log(`  GET http://${options.host}:${options.port}${options.basePath}/schemas`);
    console.log(`  GET http://${options.host}:${options.port}${options.basePath}/endpoints`);
    console.log(`  GET http://${options.host}:${options.port}${options.basePath}/auth`);
    console.log('\nPress Ctrl+C to stop');
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Validate command - Validate documentation files
 */
async function commandValidate(docs: string[], options: CliOptions): Promise<void> {
  if (docs.length === 0) {
    console.error('Error: No documentation files specified');
    console.log('Usage: doc-mcp validate <docs>');
    process.exit(1);
  }

  // Resolve paths
  const resolvedDocs = docs.map(d => path.resolve(process.cwd(), d));

  console.log('Validating documentation files...\n');

  const config = resolveConfig({
    docs: resolvedDocs,
    basePath: options.basePath,
    verbose: options.verbose,
  });
  const logger = createLogger(options.verbose);

  let hasErrors = false;

  for (const doc of resolvedDocs) {
    process.stdout.write(`  ${path.basename(doc)}: `);

    if (!fs.existsSync(doc)) {
      console.log('❌ File not found');
      hasErrors = true;
      continue;
    }

    try {
      await parseAllDocumentation([doc], config, logger);
      console.log('✅ Valid');
    } catch (error) {
      console.log('❌ Invalid');
      console.log(`    Error: ${error instanceof Error ? error.message : error}`);
      hasErrors = true;
    }
  }

  console.log('');

  if (hasErrors) {
    console.log('Validation completed with errors.');
    process.exit(1);
  } else {
    console.log('All files validated successfully.');
  }
}

/**
 * Inspect command - Display parsed documentation
 */
async function commandInspect(docs: string[], options: CliOptions): Promise<void> {
  if (docs.length === 0) {
    console.error('Error: No documentation files specified');
    console.log('Usage: doc-mcp inspect <docs>');
    process.exit(1);
  }

  // Resolve paths
  const resolvedDocs = docs.map(d => path.resolve(process.cwd(), d));

  console.log('Inspecting documentation...\n');

  const config = resolveConfig({
    docs: resolvedDocs,
    basePath: options.basePath,
    verbose: options.verbose,
  });
  const logger = createLogger(false); // Quiet for inspect

  try {
    const parseResult = await parseAllDocumentation(resolvedDocs, config, logger);
    const schema = normalizeSchema(parseResult, config, resolvedDocs, logger);

    // Display summary
    console.log('=== API Summary ===\n');
    console.log(`Title: ${schema.metadata.title}`);
    console.log(`Version: ${schema.metadata.version}`);
    console.log(`Description: ${schema.metadata.description || '(none)'}`);
    console.log(`Source type: ${schema.source.type}`);
    console.log(`Parsed at: ${schema.source.parsedAt}`);

    console.log('\n=== Servers ===\n');
    if (schema.metadata.servers && schema.metadata.servers.length > 0) {
      for (const server of schema.metadata.servers) {
        console.log(`  - ${server.url}${server.description ? ` (${server.description})` : ''}`);
      }
    } else {
      console.log('  (none)');
    }

    console.log('\n=== Endpoints ===\n');
    console.log(`Total: ${schema.endpoints.length}`);
    console.log('');

    for (const endpoint of schema.endpoints) {
      const params = endpoint.parameters.length > 0
        ? ` [${endpoint.parameters.length} params]`
        : '';
      const deprecated = endpoint.deprecated ? ' (deprecated)' : '';
      console.log(`  ${endpoint.method.padEnd(7)} ${endpoint.path}${params}${deprecated}`);
      if (endpoint.summary) {
        console.log(`          ${endpoint.summary}`);
      }
    }

    console.log('\n=== Schemas ===\n');
    const schemaNames = Object.keys(schema.schemas);
    console.log(`Total: ${schemaNames.length}`);
    if (schemaNames.length > 0) {
      console.log('');
      for (const name of schemaNames) {
        console.log(`  - ${name}`);
      }
    }

    console.log('\n=== Authentication ===\n');
    const authSchemes = Object.keys(schema.auth.schemes);
    if (authSchemes.length > 0) {
      for (const name of authSchemes) {
        const scheme = schema.auth.schemes[name];
        console.log(`  - ${name}: ${scheme.type}`);
      }
    } else {
      console.log('  No authentication required');
    }

    console.log('');
  } catch (error) {
    console.error('Failed to inspect:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main

async function main(): Promise<void> {
  const { command, docs, options } = parseCliArgs();

  switch (command) {
    case 'serve':
      await commandServe(docs, options);
      break;

    case 'validate':
      await commandValidate(docs, options);
      break;

    case 'inspect':
      await commandInspect(docs, options);
      break;

    default:
      // If first positional looks like a file, assume serve
      if (fs.existsSync(command)) {
        await commandServe([command, ...docs], options);
      } else {
        console.error(`Unknown command: ${command}`);
        console.log(HELP_TEXT);
        process.exit(1);
      }
  }
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
