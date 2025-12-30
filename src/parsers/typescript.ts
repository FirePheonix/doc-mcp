/**
 * doc-mcp - TypeScript/JavaScript Parser
 * 
 * Parses TypeScript and JavaScript source files to extract:
 * - Exported functions, classes, components
 * - JSDoc comments
 * - Type definitions and interfaces
 * - Constants and enums
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type {
  ParseResult,
  DocResource,
  CodeExample,
} from '../types';

// Handle CommonJS/ESM interop
const babelTraverse = typeof traverse === 'function' ? traverse : (traverse as any).default;


// Parser Interface


/**
 * Parse a TypeScript/JavaScript file and extract documentation
 */
export async function parseTypeScript(content: string, filePath: string): Promise<ParseResult> {
  const resources: DocResource[] = [];
  
  try {
    // Parse with Babel (supports TS, JSX, etc.)
    const ast = parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
    });
    
    // Extract exports
    const exports = extractExports(ast, content, filePath);
    resources.push(...exports);
    
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
  }
  
  return {
    metadata: {},
    endpoints: [],
    schemas: {},
    auth: {},
    resources,
  };
}


// Export Extraction


interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'interface' | 'type' | 'enum';
  code: string;
  jsdoc?: string;
  signature?: string;
  start: number;
  end: number;
}

/**
 * Extract all exported declarations from AST
 */
function extractExports(ast: any, sourceCode: string, filePath: string): DocResource[] {
  const exports: ExportInfo[] = [];
  const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(ts|tsx|js|jsx)$/i, '') || 'file';
  
  babelTraverse(ast, {
    // Export named declarations: export function foo() {}
    ExportNamedDeclaration(path: any) {
      const declaration = path.node.declaration;
      if (!declaration) return;
      
      // Function declaration
      if (declaration.type === 'FunctionDeclaration' && declaration.id) {
        exports.push({
          name: declaration.id.name,
          type: 'function',
          code: extractCode(sourceCode, declaration.start, declaration.end),
          jsdoc: extractJSDoc(path.node.leadingComments),
          signature: extractFunctionSignature(declaration),
          start: declaration.start,
          end: declaration.end,
        });
      }
      
      // Class declaration
      if (declaration.type === 'ClassDeclaration' && declaration.id) {
        exports.push({
          name: declaration.id.name,
          type: 'class',
          code: extractCode(sourceCode, declaration.start, declaration.end),
          jsdoc: extractJSDoc(path.node.leadingComments),
          start: declaration.start,
          end: declaration.end,
        });
      }
      
      // Variable declaration (const, let, var)
      if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type === 'Identifier') {
            exports.push({
              name: declarator.id.name,
              type: 'const',
              code: extractCode(sourceCode, declaration.start, declaration.end),
              jsdoc: extractJSDoc(path.node.leadingComments),
              start: declaration.start,
              end: declaration.end,
            });
          }
        }
      }
      
      // TypeScript interface
      if (declaration.type === 'TSInterfaceDeclaration') {
        exports.push({
          name: declaration.id.name,
          type: 'interface',
          code: extractCode(sourceCode, declaration.start, declaration.end),
          jsdoc: extractJSDoc(path.node.leadingComments),
          start: declaration.start,
          end: declaration.end,
        });
      }
      
      // TypeScript type alias
      if (declaration.type === 'TSTypeAliasDeclaration') {
        exports.push({
          name: declaration.id.name,
          type: 'type',
          code: extractCode(sourceCode, declaration.start, declaration.end),
          jsdoc: extractJSDoc(path.node.leadingComments),
          start: declaration.start,
          end: declaration.end,
        });
      }
      
      // TypeScript enum
      if (declaration.type === 'TSEnumDeclaration') {
        exports.push({
          name: declaration.id.name,
          type: 'enum',
          code: extractCode(sourceCode, declaration.start, declaration.end),
          jsdoc: extractJSDoc(path.node.leadingComments),
          start: declaration.start,
          end: declaration.end,
        });
      }
    },
    
    // Export default: export default function Foo() {}
    ExportDefaultDeclaration(path: any) {
      const declaration = path.node.declaration;
      let name = 'default';
      
      if (declaration.id) {
        name = declaration.id.name;
      } else {
        // Use filename as name for default exports
        name = fileName.charAt(0).toUpperCase() + fileName.slice(1);
      }
      
      exports.push({
        name,
        type: declaration.type.includes('Function') ? 'function' : 'const',
        code: extractCode(sourceCode, declaration.start, declaration.end),
        jsdoc: extractJSDoc(path.node.leadingComments),
        start: declaration.start,
        end: declaration.end,
      });
    },
  });
  
  // Convert to DocResource format
  return exports.map(exp => exportToResource(exp, filePath));
}


// Helper Functions


/**
 * Extract code snippet from source
 */
function extractCode(source: string, start: number, end: number): string {
  return source.substring(start, end).trim();
}

/**
 * Extract JSDoc comment
 */
function extractJSDoc(comments: any[] | null | undefined): string | undefined {
  if (!comments || comments.length === 0) return undefined;
  
  const lastComment = comments[comments.length - 1];
  if (lastComment.type === 'CommentBlock') {
    return lastComment.value.trim();
  }
  
  return undefined;
}

/**
 * Extract function signature
 */
function extractFunctionSignature(node: any): string {
  const params = node.params.map((p: any) => {
    if (p.type === 'Identifier') {
      return p.name;
    }
    if (p.type === 'ObjectPattern') {
      return '{ ... }';
    }
    return '...';
  }).join(', ');
  
  const name = node.id?.name || 'anonymous';
  return `${name}(${params})`;
}

/**
 * Parse JSDoc to extract description and tags
 */
function parseJSDoc(jsdoc: string): { description: string; tags: Record<string, string> } {
  const lines = jsdoc.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim());
  const description: string[] = [];
  const tags: Record<string, string> = {};
  
  for (const line of lines) {
    if (line.startsWith('@')) {
      const match = line.match(/@(\w+)\s+(.+)/);
      if (match) {
        tags[match[1]] = match[2];
      }
    } else if (line) {
      description.push(line);
    }
  }
  
  return {
    description: description.join(' '),
    tags,
  };
}

/**
 * Detect category from file path
 */
function detectCategoryFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  
  if (lower.includes('component')) return 'components';
  if (lower.includes('hook')) return 'hooks';
  if (lower.includes('util')) return 'utilities';
  if (lower.includes('helper')) return 'utilities';
  if (lower.includes('service')) return 'services';
  if (lower.includes('api')) return 'api';
  if (lower.includes('type')) return 'types';
  if (lower.includes('constant')) return 'constants';
  
  return 'code';
}

/**
 * Convert ExportInfo to DocResource
 */
function exportToResource(exp: ExportInfo, filePath: string): DocResource {
  const parsed = exp.jsdoc ? parseJSDoc(exp.jsdoc) : { description: '', tags: {} };
  
  const codeExample: CodeExample = {
    language: filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? 'tsx' : 'typescript',
    code: exp.code,
    title: exp.signature || exp.name,
  };
  
  // Extract keywords from code
  const keywords = new Set<string>();
  keywords.add(exp.name.toLowerCase());
  keywords.add(exp.type);
  
  // Add words from JSDoc
  if (parsed.description) {
    parsed.description.split(/\s+/).forEach(word => {
      if (word.length > 3) keywords.add(word.toLowerCase());
    });
  }
  
  return {
    id: `${filePath}:${exp.name}`,
    name: exp.name,
    category: detectCategoryFromPath(filePath),
    summary: parsed.description || `${exp.type} ${exp.name}`,
    content: exp.jsdoc ? `${parsed.description}\n\n\`\`\`typescript\n${exp.code}\n\`\`\`` : exp.code,
    codeExamples: [codeExample],
    source: filePath,
    keywords: Array.from(keywords).slice(0, 20),
  };
}


// File Type Detection


/**
 * Check if a file is a TypeScript/JavaScript file
 */
export function isTypeScriptFile(filePath: string): boolean {
  const ext = filePath.toLowerCase();
  return ext.endsWith('.ts') || 
         ext.endsWith('.tsx') || 
         ext.endsWith('.js') || 
         ext.endsWith('.jsx') ||
         ext.endsWith('.mts') ||
         ext.endsWith('.mjs');
}
