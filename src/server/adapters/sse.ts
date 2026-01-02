/**
 * MCP Server-Sent Events (SSE) Adapter
 * 
 * Implements MCP protocol over HTTP using SSE for VS Code compatibility
 * Based on MCP Specification: https://spec.modelcontextprotocol.io/
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { NormalizedSchema, ResolvedConfig, EndpointSchema, DocResource, ParameterSchema } from '../../types';
import { randomUUID } from 'crypto';

// JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Session management
interface McpSession {
  id: string;
  reply: FastifyReply;
  schema: NormalizedSchema;
  config: ResolvedConfig;
  initialized: boolean;
}

const sessions = new Map<string, McpSession>();

/**
 * Add SSE endpoint for MCP protocol communication
 */
export function addMcpSseEndpoint(
  fastify: FastifyInstance,
  schema: NormalizedSchema,
  config: ResolvedConfig
) {
  const basePath = config.basePath || '/mcp';
  
  // SSE endpoint - establishes connection and sends endpoint URL
  fastify.get(`${basePath}/sse`, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = randomUUID();
    
    // Set SSE headers - includes headers to disable buffering on proxies like Cloudflare
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      // Cloudflare-specific headers to disable buffering
      'CF-Cache-Status': 'DYNAMIC',
      'Transfer-Encoding': 'chunked',
    });

    // Create session
    const session: McpSession = {
      id: sessionId,
      reply,
      schema,
      config,
      initialized: false,
    };
    sessions.set(sessionId, session);

    // Send the endpoint URL for the client to POST messages to
    const messageEndpoint = `${basePath}/message?sessionId=${sessionId}`;
    sendSseEvent(reply, 'endpoint', messageEndpoint);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    // Cleanup on close
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      sessions.delete(sessionId);
    });

    // Don't end the response - keep SSE connection open
    return reply;
  });

  // Message endpoint - receives JSON-RPC requests from client
  fastify.post(`${basePath}/message`, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { sessionId?: string };
    const sessionId = query.sessionId;

    if (!sessionId || !sessions.has(sessionId)) {
      return reply.status(400).send({ error: 'Invalid or missing session ID' });
    }

    const session = sessions.get(sessionId)!;
    const jsonRpcRequest = request.body as JsonRpcRequest;

    // Handle the JSON-RPC request
    const response = await handleMcpRequest(jsonRpcRequest, session);

    // Send response via SSE
    sendSseEvent(session.reply, 'message', JSON.stringify(response));

    // Also return response directly for the POST
    return reply.send(response);
  });

  // Add CORS preflight handlers
  fastify.options(`${basePath}/sse`, corsHandler);
  fastify.options(`${basePath}/message`, corsHandler);
}

/**
 * CORS preflight handler
 */
async function corsHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply
    .header('Access-Control-Allow-Origin', '*')
    .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Accept')
    .send();
}

/**
 * Send SSE event
 */
function sendSseEvent(reply: FastifyReply, event: string, data: string) {
  try {
    reply.raw.write(`event: ${event}\ndata: ${data}\n\n`);
  } catch {
    // Connection may be closed
  }
}

/**
 * Handle MCP JSON-RPC request
 */
async function handleMcpRequest(
  request: JsonRpcRequest,
  session: McpSession
): Promise<JsonRpcResponse> {
  const { method, id, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id, session);
      
      case 'initialized':
        session.initialized = true;
        return { jsonrpc: '2.0', id, result: {} };
      
      case 'tools/list':
        return handleToolsList(id, session);
      
      case 'tools/call':
        return handleToolsCall(id, params as { name: string; arguments?: Record<string, unknown> }, session);
      
      case 'resources/list':
        return handleResourcesList(id, session);
      
      case 'resources/read':
        return handleResourcesRead(id, params as { uri: string }, session);
      
      case 'prompts/list':
        return { jsonrpc: '2.0', id, result: { prompts: [] } };
      
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };
      
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

/**
 * Handle initialize request
 */
function handleInitialize(id: string | number, session: McpSession): JsonRpcResponse {
  const { schema } = session;
  
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: schema.metadata.title || 'doc-mcp',
        version: schema.metadata.version || '1.0.0',
      },
    },
  };
}

/**
 * Helper: Get parameters by location
 */
function getParamsByLocation(params: ParameterSchema[], location: 'path' | 'query' | 'header'): ParameterSchema[] {
  return params.filter(p => p.in === location);
}

/**
 * Handle tools/list request - expose API documentation as tools
 */
function handleToolsList(id: string | number, session: McpSession): JsonRpcResponse {
  const { schema } = session;
  
  // Convert endpoints to tools
  const tools = schema.endpoints.map((endpoint: EndpointSchema) => ({
    name: `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    description: endpoint.summary || endpoint.description || `${endpoint.method} ${endpoint.path}`,
    inputSchema: {
      type: 'object',
      properties: buildToolProperties(endpoint),
      required: getRequiredParams(endpoint),
    },
  }));

  // Add a general "search_docs" tool
  tools.push({
    name: 'search_docs',
    description: 'Search the API documentation',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  });

  return {
    jsonrpc: '2.0',
    id,
    result: { tools },
  };
}

/**
 * Build tool properties from endpoint parameters
 */
function buildToolProperties(endpoint: EndpointSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  
  // Path parameters
  for (const param of getParamsByLocation(endpoint.parameters || [], 'path')) {
    properties[param.name] = {
      type: param.type || 'string',
      description: param.description || `Path parameter: ${param.name}`,
    };
  }
  
  // Query parameters
  for (const param of getParamsByLocation(endpoint.parameters || [], 'query')) {
    properties[param.name] = {
      type: param.type || 'string',
      description: param.description || `Query parameter: ${param.name}`,
    };
  }
  
  // Request body
  if (endpoint.requestBody?.content) {
    properties['body'] = {
      type: 'object',
      description: endpoint.requestBody.description || 'Request body',
    };
  }
  
  return properties;
}

/**
 * Get required parameters from endpoint
 */
function getRequiredParams(endpoint: EndpointSchema): string[] {
  const required: string[] = [];
  
  for (const param of getParamsByLocation(endpoint.parameters || [], 'path')) {
    if (param.required) required.push(param.name);
  }
  
  for (const param of getParamsByLocation(endpoint.parameters || [], 'query')) {
    if (param.required) required.push(param.name);
  }
  
  if (endpoint.requestBody?.required) {
    required.push('body');
  }
  
  return required;
}

/**
 * Handle tools/call request
 */
function handleToolsCall(
  id: string | number,
  params: { name: string; arguments?: Record<string, unknown> },
  session: McpSession
): JsonRpcResponse {
  const { schema } = session;
  const { name, arguments: args } = params;

  // Handle search_docs tool
  if (name === 'search_docs') {
    const query = (args?.query as string || '').toLowerCase();
    const results = schema.resources.filter((r: DocResource) =>
      r.name.toLowerCase().includes(query) ||
      r.summary?.toLowerCase().includes(query) ||
      r.content?.toLowerCase().includes(query)
    );
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: results.length > 0
            ? results.map((r: DocResource) => `## ${r.name}\n${r.summary || ''}\n\n${r.content || ''}`).join('\n\n---\n\n')
            : 'No results found',
        }],
      },
    };
  }

  // Find matching endpoint
  const endpoint = schema.endpoints.find((e: EndpointSchema) => 
    `${e.method.toLowerCase()}_${e.path.replace(/[^a-zA-Z0-9]/g, '_')}` === name
  );

  if (!endpoint) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: `Unknown tool: ${name}` },
    };
  }

  // Return endpoint documentation
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{
        type: 'text',
        text: formatEndpointDocs(endpoint),
      }],
    },
  };
}

/**
 * Format endpoint documentation as text
 */
function formatEndpointDocs(endpoint: EndpointSchema): string {
  let text = `# ${endpoint.method} ${endpoint.path}\n\n`;
  
  if (endpoint.summary) text += `${endpoint.summary}\n\n`;
  if (endpoint.description) text += `${endpoint.description}\n\n`;
  
  // All parameters
  const allParams = endpoint.parameters || [];
  
  if (allParams.length > 0) {
    text += '## Parameters\n\n';
    for (const param of allParams) {
      text += `- **${param.name}** (${param.in}${param.required ? ', required' : ''}): ${param.description || ''}\n`;
    }
    text += '\n';
  }
  
  // Request body
  if (endpoint.requestBody) {
    text += '## Request Body\n\n';
    if (endpoint.requestBody.description) {
      text += `${endpoint.requestBody.description}\n\n`;
    }
    // Get schema from content
    const contentTypes = Object.keys(endpoint.requestBody.content || {});
    if (contentTypes.length > 0) {
      const firstContentType = contentTypes[0];
      const mediaContent = endpoint.requestBody.content[firstContentType];
      if (mediaContent?.schema) {
        text += '```json\n' + JSON.stringify(mediaContent.schema, null, 2) + '\n```\n\n';
      }
    }
  }
  
  // Responses
  if (endpoint.responses && endpoint.responses.length > 0) {
    text += '## Responses\n\n';
    for (const resp of endpoint.responses) {
      text += `### ${resp.statusCode}\n${resp.description || ''}\n\n`;
    }
  }
  
  return text;
}

/**
 * Handle resources/list request
 */
function handleResourcesList(id: string | number, session: McpSession): JsonRpcResponse {
  const { schema } = session;
  
  // Convert doc resources to MCP resources
  const resources = schema.resources.map((resource: DocResource) => ({
    uri: `doc://${resource.id}`,
    name: resource.name,
    description: resource.summary || '',
    mimeType: 'text/markdown',
  }));

  // Also add endpoints as resources
  for (const endpoint of schema.endpoints) {
    resources.push({
      uri: `endpoint://${endpoint.method}${endpoint.path}`,
      name: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.summary || endpoint.description || '',
      mimeType: 'text/markdown',
    });
  }

  return {
    jsonrpc: '2.0',
    id,
    result: { resources },
  };
}

/**
 * Handle resources/read request
 */
function handleResourcesRead(
  id: string | number,
  params: { uri: string },
  session: McpSession
): JsonRpcResponse {
  const { schema } = session;
  const { uri } = params;

  // Handle doc:// URIs
  if (uri.startsWith('doc://')) {
    const resourceId = uri.replace('doc://', '');
    const resource = schema.resources.find((r: DocResource) => r.id === resourceId);
    
    if (!resource) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Resource not found: ${uri}` },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: resource.content || `# ${resource.name}\n\n${resource.summary || ''}`,
        }],
      },
    };
  }

  // Handle endpoint:// URIs
  if (uri.startsWith('endpoint://')) {
    const endpointRef = uri.replace('endpoint://', '');
    const endpoint = schema.endpoints.find((e: EndpointSchema) => 
      `${e.method}${e.path}` === endpointRef
    );
    
    if (!endpoint) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Endpoint not found: ${uri}` },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: formatEndpointDocs(endpoint),
        }],
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32602, message: `Unknown URI scheme: ${uri}` },
  };
}
