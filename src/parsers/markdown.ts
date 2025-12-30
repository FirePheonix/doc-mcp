/**
 * doc-mcp - Markdown Parser
 * 
 * Parses markdown documentation files and extracts API information.
 * Supports common API documentation patterns and structured markdown.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Code, Text, List } from 'mdast';
import type {
  ParseResult,
  ApiMetadata,
  EndpointSchema,
  ParameterSchema,
  JsonSchema,
  AuthInfo,
  DocResource,
  CodeExample,
} from '../types';


// Types for Markdown AST


interface MarkdownSection {
  title: string;
  level: number;
  content: string[];
  codeBlocks: Array<{ lang: string; value: string }>;
  children: MarkdownSection[];
}


// Main Parser


/**
 * Parse a markdown file and extract API documentation
 */
export async function parseMarkdown(content: string, filePath: string): Promise<ParseResult> {
  const processor = unified().use(remarkParse);
  const tree = processor.parse(content) as Root;
  
  // Build a structured representation of the markdown
  const sections = extractSections(tree);
  
  // Extract various parts
  const metadata = extractMetadataFromMarkdown(sections, filePath);
  const endpoints = extractEndpointsFromMarkdown(sections);
  const schemas = extractSchemasFromMarkdown(sections);
  const auth = extractAuthFromMarkdown(sections);
  const resources = extractResourcesFromMarkdown(sections, filePath);
  
  return { metadata, endpoints, schemas, auth, resources };
}


// Section Extraction


/**
 * Extract hierarchical sections from markdown AST
 */
function extractSections(tree: Root): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const stack: MarkdownSection[] = [];
  let currentContent: string[] = [];
  let currentCodeBlocks: Array<{ lang: string; value: string }> = [];
  
  visit(tree, (node) => {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const title = extractTextFromNode(heading);
      const level = heading.depth;
      
      // Create new section
      const section: MarkdownSection = {
        title,
        level,
        content: [],
        codeBlocks: [],
        children: [],
      };
      
      // Pop stack until we find a parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        const completed = stack.pop()!;
        completed.content = currentContent;
        completed.codeBlocks = currentCodeBlocks;
        currentContent = [];
        currentCodeBlocks = [];
      }
      
      // Add to parent or root
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(section);
      } else {
        // Save any content before first heading
        if (currentContent.length > 0 || currentCodeBlocks.length > 0) {
          sections.push({
            title: '_preamble',
            level: 0,
            content: currentContent,
            codeBlocks: currentCodeBlocks,
            children: [],
          });
          currentContent = [];
          currentCodeBlocks = [];
        }
        sections.push(section);
      }
      
      stack.push(section);
    } else if (node.type === 'paragraph') {
      const text = extractTextFromNode(node);
      if (text) currentContent.push(text);
    } else if (node.type === 'code') {
      const code = node as Code;
      currentCodeBlocks.push({
        lang: code.lang || 'text',
        value: code.value,
      });
    } else if (node.type === 'list') {
      const items = extractListItems(node as List);
      currentContent.push(...items);
    }
  });
  
  // Finalize remaining sections
  while (stack.length > 0) {
    const completed = stack.pop()!;
    if (completed.content.length === 0) {
      completed.content = currentContent;
      completed.codeBlocks = currentCodeBlocks;
      currentContent = [];
      currentCodeBlocks = [];
    }
  }
  
  return sections;
}

/**
 * Extract text content from any node
 */
function extractTextFromNode(node: unknown): string {
  const parts: string[] = [];
  
  visit(node as Root, 'text', (textNode: Text) => {
    parts.push(textNode.value);
  });
  
  visit(node as Root, 'inlineCode', (codeNode: { value: string }) => {
    parts.push(codeNode.value);
  });
  
  return parts.join('').trim();
}

/**
 * Extract list items as strings
 */
function extractListItems(list: List): string[] {
  const items: string[] = [];
  
  for (const item of list.children) {
    if (item.type === 'listItem') {
      const text = extractTextFromNode(item);
      if (text) items.push(`- ${text}`);
    }
  }
  
  return items;
}


// Metadata Extraction


function extractMetadataFromMarkdown(sections: MarkdownSection[], _filePath: string): Partial<ApiMetadata> {
  const metadata: Partial<ApiMetadata> = {};
  
  // Look for title in first heading
  const firstSection = sections.find(s => s.level === 1);
  if (firstSection) {
    metadata.title = firstSection.title;
    
    // Look for description in content
    if (firstSection.content.length > 0) {
      metadata.description = firstSection.content.join('\n');
    }
  }
  
  // Look for version in any section
  for (const section of flattenSections(sections)) {
    const versionMatch = section.content.join(' ').match(/version[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1];
      break;
    }
  }
  
  // Look for server/base URL
  for (const section of flattenSections(sections)) {
    const urlMatch = section.content.join(' ').match(/(?:base\s*url|server|api\s*url)[:\s]+(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      metadata.servers = [{ url: urlMatch[1] }];
      break;
    }
  }
  
  return metadata;
}


// Endpoint Extraction


const HTTP_METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([\/\w\{\}\-\.:]+)/i;

// Reserved for future pattern matching
// const ENDPOINT_SECTION_PATTERNS = [
//   /endpoints?/i,
//   /api\s*reference/i,
//   /routes?/i,
//   /resources?/i,
// ];

function extractEndpointsFromMarkdown(sections: MarkdownSection[]): Partial<EndpointSchema>[] {
  const endpoints: Partial<EndpointSchema>[] = [];
  
  for (const section of flattenSections(sections)) {
    // Check if section title contains an endpoint definition
    const titleMatch = section.title.match(HTTP_METHOD_PATTERN);
    if (titleMatch) {
      const endpoint = createEndpointFromSection(section, titleMatch);
      endpoints.push(endpoint);
      continue;
    }
    
    // Check code blocks for endpoint definitions
    for (const codeBlock of section.codeBlocks) {
      if (codeBlock.lang === 'http' || codeBlock.lang === 'rest' || codeBlock.lang === '') {
        const codeMatch = codeBlock.value.match(HTTP_METHOD_PATTERN);
        if (codeMatch) {
          const endpoint = createEndpointFromCodeBlock(section, codeBlock, codeMatch);
          endpoints.push(endpoint);
        }
      }
    }
    
    // Check content for endpoint patterns
    for (const line of section.content) {
      const lineMatch = line.match(HTTP_METHOD_PATTERN);
      if (lineMatch) {
        endpoints.push({
          method: lineMatch[1].toUpperCase() as EndpointSchema['method'],
          path: lineMatch[2],
          description: section.content.filter(c => c !== line).join('\n'),
          tags: [section.title],
        });
      }
    }
  }
  
  return endpoints;
}

function createEndpointFromSection(section: MarkdownSection, match: RegExpMatchArray): Partial<EndpointSchema> {
  const method = match[1].toUpperCase() as EndpointSchema['method'];
  const path = match[2];
  
  const endpoint: Partial<EndpointSchema> = {
    method,
    path,
    summary: section.title.replace(HTTP_METHOD_PATTERN, '').trim() || undefined,
    description: section.content.join('\n'),
    parameters: extractParametersFromSection(section),
    responses: [],
  };
  
  // Look for response info in children
  for (const child of section.children) {
    if (/response/i.test(child.title)) {
      const statusMatch = child.title.match(/(\d{3})/);
      endpoint.responses?.push({
        statusCode: statusMatch ? parseInt(statusMatch[1], 10) : 200,
        description: child.content.join('\n'),
      });
    }
  }
  
  return endpoint;
}

function createEndpointFromCodeBlock(
  section: MarkdownSection,
  _codeBlock: { lang: string; value: string },
  match: RegExpMatchArray
): Partial<EndpointSchema> {
  return {
    method: match[1].toUpperCase() as EndpointSchema['method'],
    path: match[2],
    description: section.content.join('\n'),
    tags: [section.title],
    parameters: [],
    responses: [],
  };
}

function extractParametersFromSection(section: MarkdownSection): ParameterSchema[] {
  const parameters: ParameterSchema[] = [];
  
  // Look for parameter definitions in content
  const paramPatterns = [
    /[-*]\s*`?(\w+)`?\s*\((\w+)\)\s*[-:]\s*(.+)/,  // - param (type) - description
    /[-*]\s*`?(\w+)`?\s*:\s*(\w+)\s*[-:]\s*(.+)/,  // - param: type - description
    /\|\s*`?(\w+)`?\s*\|\s*(\w+)\s*\|\s*(.+)\s*\|/, // | param | type | description |
  ];
  
  for (const line of section.content) {
    for (const pattern of paramPatterns) {
      const match = line.match(pattern);
      if (match) {
        parameters.push({
          name: match[1],
          in: 'query', // Default, would need more context to determine
          required: line.toLowerCase().includes('required'),
          type: match[2].toLowerCase(),
          description: match[3].trim(),
        });
        break;
      }
    }
  }
  
  // Check for path parameters in the endpoint path
  const pathParamPattern = /\{(\w+)\}/g;
  let pathMatch;
  const pathContent = section.title + ' ' + section.content.join(' ');
  while ((pathMatch = pathParamPattern.exec(pathContent)) !== null) {
    const paramName = pathMatch[1];
    if (!parameters.find(p => p.name === paramName)) {
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        type: 'string',
      });
    }
  }
  
  return parameters;
}


// Schema Extraction


function extractSchemasFromMarkdown(sections: MarkdownSection[]): Record<string, JsonSchema> {
  const schemas: Record<string, JsonSchema> = {};
  
  for (const section of flattenSections(sections)) {
    // Look for JSON code blocks that might be schemas
    for (const codeBlock of section.codeBlocks) {
      if (codeBlock.lang === 'json' || codeBlock.lang === 'jsonschema') {
        try {
          const parsed = JSON.parse(codeBlock.value);
          
          // Check if it looks like a schema
          if (parsed.type || parsed.properties || parsed.$schema) {
            const schemaName = section.title.replace(/[^a-zA-Z0-9]/g, '') || 'Schema';
            schemas[schemaName] = parsed;
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    }
    
    // Look for TypeScript/JavaScript interfaces
    for (const codeBlock of section.codeBlocks) {
      if (codeBlock.lang === 'typescript' || codeBlock.lang === 'ts') {
        const schema = parseTypeScriptInterface(codeBlock.value, section.title);
        if (schema) {
          Object.assign(schemas, schema);
        }
      }
    }
  }
  
  return schemas;
}

/**
 * Very basic TypeScript interface to JSON Schema conversion
 */
function parseTypeScriptInterface(code: string, _defaultName: string): Record<string, JsonSchema> | null {
  const schemas: Record<string, JsonSchema> = {};
  const interfacePattern = /interface\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = interfacePattern.exec(code)) !== null) {
    const name = match[1];
    const body = match[2];
    
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    
    // Parse property lines
    const propPattern = /(\w+)(\?)?:\s*(\w+(?:\[\])?)/g;
    let propMatch;
    while ((propMatch = propPattern.exec(body)) !== null) {
      const propName = propMatch[1];
      const optional = propMatch[2] === '?';
      const propType = propMatch[3];
      
      properties[propName] = {
        type: mapTypeScriptType(propType),
      };
      
      if (!optional) {
        required.push(propName);
      }
    }
    
    if (Object.keys(properties).length > 0) {
      schemas[name] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
  }
  
  return Object.keys(schemas).length > 0 ? schemas : null;
}

function mapTypeScriptType(tsType: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    'string[]': 'array',
    'number[]': 'array',
    any: 'object',
    object: 'object',
  };
  
  return typeMap[tsType.toLowerCase()] || 'string';
}


// Auth Extraction


const AUTH_SECTION_PATTERNS = [
  /auth(?:entication|orization)?/i,
  /security/i,
  /api\s*key/i,
];

function extractAuthFromMarkdown(sections: MarkdownSection[]): Partial<AuthInfo> {
  const auth: Partial<AuthInfo> = {
    schemes: {},
  };
  
  for (const section of flattenSections(sections)) {
    const matchesAuthSection = AUTH_SECTION_PATTERNS.some(p => p.test(section.title));
    if (!matchesAuthSection) continue;
    
    const content = section.content.join(' ').toLowerCase();
    
    // Detect auth types
    if (content.includes('api key') || content.includes('apikey')) {
      const headerMatch = content.match(/header[:\s]+[`"]?([a-z0-9-_]+)[`"]?/i);
      auth.schemes!['apiKey'] = {
        type: 'apiKey',
        name: headerMatch ? headerMatch[1] : 'X-API-Key',
        in: 'header',
        description: section.content.join('\n'),
      };
    }
    
    if (content.includes('bearer') || content.includes('jwt') || content.includes('token')) {
      auth.schemes!['bearer'] = {
        type: 'http',
        scheme: 'bearer',
        description: section.content.join('\n'),
      };
    }
    
    if (content.includes('basic auth')) {
      auth.schemes!['basic'] = {
        type: 'http',
        scheme: 'basic',
        description: section.content.join('\n'),
      };
    }
    
    if (content.includes('oauth')) {
      auth.schemes!['oauth2'] = {
        type: 'oauth2',
        description: section.content.join('\n'),
      };
    }
    
    // Set description
    if (!auth.description) {
      auth.description = section.content.join('\n');
    }
  }
  
  return auth;
}


// Resource Extraction (for documentation queries)


/**
 * Extract documentation resources from markdown sections
 * This allows Copilot/Cursor to query documentation content
 */
function extractResourcesFromMarkdown(sections: MarkdownSection[], filePath: string): DocResource[] {
  const resources: DocResource[] = [];
  const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(md|markdown|mdx)$/i, '') || 'doc';
  
  for (const section of flattenSections(sections)) {
    // Skip preamble and very short sections
    if (section.title === '_preamble' || section.level === 0) continue;
    if (section.content.length === 0 && section.codeBlocks.length === 0) continue;
    
    // Create resource from each meaningful section
    const resource = createResourceFromSection(section, filePath, fileName);
    if (resource) {
      resources.push(resource);
    }
  }
  
  // Also create a root resource for the entire file
  const firstSection = sections.find(s => s.level === 1);
  if (firstSection) {
    const rootResource: DocResource = {
      id: `${fileName}`,
      name: firstSection.title || fileName,
      category: detectCategory(filePath, firstSection.title),
      summary: firstSection.content.slice(0, 2).join(' ').substring(0, 200),
      content: sectionsToContent(sections),
      codeExamples: extractAllCodeExamples(sections),
      source: filePath,
      keywords: extractKeywords(sections),
    };
    resources.unshift(rootResource);
  }
  
  return resources;
}

/**
 * Create a DocResource from a markdown section
 */
function createResourceFromSection(
  section: MarkdownSection,
  filePath: string,
  fileName: string
): DocResource | null {
  // Only create resources for level 2 and 3 sections (## and ###)
  if (section.level < 2 || section.level > 3) return null;
  
  const codeExamples: CodeExample[] = section.codeBlocks.map((block, index) => ({
    language: block.lang || 'text',
    code: block.value,
    title: section.children[index]?.title || undefined,
  }));
  
  // Include children's code blocks too
  for (const child of section.children) {
    for (const block of child.codeBlocks) {
      codeExamples.push({
        language: block.lang || 'text',
        code: block.value,
        title: child.title || undefined,
      });
    }
  }
  
  const id = `${fileName}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const content = [
    section.content.join('\n'),
    ...section.children.map(c => `### ${c.title}\n${c.content.join('\n')}`),
  ].join('\n\n');
  
  return {
    id,
    name: section.title,
    category: detectCategory(filePath, section.title),
    summary: section.content.slice(0, 2).join(' ').substring(0, 200),
    content,
    codeExamples,
    source: filePath,
    keywords: extractSectionKeywords(section),
  };
}

/**
 * Detect the category/type of documentation
 */
function detectCategory(filePath: string, title: string): string {
  const lowerPath = filePath.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Check path for category hints
  if (lowerPath.includes('component')) return 'components';
  if (lowerPath.includes('hook')) return 'hooks';
  if (lowerPath.includes('api')) return 'api';
  if (lowerPath.includes('guide')) return 'guides';
  if (lowerPath.includes('tutorial')) return 'tutorials';
  if (lowerPath.includes('example')) return 'examples';
  if (lowerPath.includes('util')) return 'utilities';
  
  // Check title for hints
  if (lowerTitle.startsWith('use')) return 'hooks';
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(title)) return 'components'; // PascalCase
  if (lowerTitle.includes('install')) return 'getting-started';
  if (lowerTitle.includes('config')) return 'configuration';
  
  return 'documentation';
}

/**
 * Extract keywords from all sections
 */
function extractKeywords(sections: MarkdownSection[]): string[] {
  const keywords = new Set<string>();
  
  for (const section of flattenSections(sections)) {
    // Add section title words
    section.title.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word.toLowerCase());
    });
    
    // Extract code identifiers
    for (const block of section.codeBlocks) {
      // Function/method names
      const funcMatches = block.value.match(/(?:function|const|let|var|def|class)\s+(\w+)/g);
      if (funcMatches) {
        funcMatches.forEach(m => {
          const name = m.split(/\s+/)[1];
          if (name && name.length > 2) keywords.add(name.toLowerCase());
        });
      }
      
      // Import names
      const importMatches = block.value.match(/import\s+(?:\{[^}]+\}|\w+)/g);
      if (importMatches) {
        importMatches.forEach(m => {
          const names = m.replace(/import\s+\{?|\}?/g, '').split(',');
          names.forEach(n => {
            const name = n.trim();
            if (name.length > 2) keywords.add(name.toLowerCase());
          });
        });
      }
    }
  }
  
  return Array.from(keywords).slice(0, 50); // Limit keywords
}

/**
 * Extract keywords from a single section
 */
function extractSectionKeywords(section: MarkdownSection): string[] {
  const keywords = new Set<string>();
  
  // Title words
  section.title.split(/\s+/).forEach(word => {
    if (word.length > 2) keywords.add(word.toLowerCase());
  });
  
  // Code identifiers from this section
  for (const block of section.codeBlocks) {
    const funcMatches = block.value.match(/(?:function|const|let|var|def|class)\s+(\w+)/g);
    if (funcMatches) {
      funcMatches.forEach(m => {
        const name = m.split(/\s+/)[1];
        if (name && name.length > 2) keywords.add(name.toLowerCase());
      });
    }
  }
  
  return Array.from(keywords).slice(0, 20);
}

/**
 * Convert all sections to content string
 */
function sectionsToContent(sections: MarkdownSection[]): string {
  const parts: string[] = [];
  
  for (const section of sections) {
    if (section.title && section.title !== '_preamble') {
      const prefix = '#'.repeat(section.level || 1);
      parts.push(`${prefix} ${section.title}`);
    }
    if (section.content.length > 0) {
      parts.push(section.content.join('\n'));
    }
    for (const block of section.codeBlocks) {
      parts.push(`\`\`\`${block.lang}\n${block.value}\n\`\`\``);
    }
  }
  
  return parts.join('\n\n');
}

/**
 * Extract all code examples from sections
 */
function extractAllCodeExamples(sections: MarkdownSection[]): CodeExample[] {
  const examples: CodeExample[] = [];
  
  for (const section of flattenSections(sections)) {
    for (const block of section.codeBlocks) {
      examples.push({
        language: block.lang || 'text',
        code: block.value,
        title: section.title !== '_preamble' ? section.title : undefined,
      });
    }
  }
  
  return examples;
}


// Utilities


/**
 * Flatten nested sections into a single array
 */
function flattenSections(sections: MarkdownSection[]): MarkdownSection[] {
  const result: MarkdownSection[] = [];
  
  function traverse(section: MarkdownSection) {
    result.push(section);
    for (const child of section.children) {
      traverse(child);
    }
  }
  
  for (const section of sections) {
    traverse(section);
  }
  
  return result;
}

/**
 * Check if a file is likely a markdown file
 */
export function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.toLowerCase();
  return ext.endsWith('.md') || ext.endsWith('.markdown') || ext.endsWith('.mdx');
}
