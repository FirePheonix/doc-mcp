/**
 * doc-mcp - Logger
 * 
 * Simple logging utility with configurable verbosity
 */

import type { Logger } from '../types';

/**
 * Create a logger instance
 */
export function createLogger(verbose: boolean): Logger {
  const prefix = '[doc-mcp]';
  
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (verbose) {
        console.debug(`${prefix} ${message}`, ...args);
      }
    },
    
    info: (message: string, ...args: unknown[]) => {
      console.info(`${prefix} ${message}`, ...args);
    },
    
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`${prefix} ⚠️  ${message}`, ...args);
    },
    
    error: (message: string, ...args: unknown[]) => {
      console.error(`${prefix} ❌ ${message}`, ...args);
    },
  };
}

/**
 * No-op logger for silent operation
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
