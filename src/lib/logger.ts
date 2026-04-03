/**
 * src/lib/logger.ts
 * =================
 * Centralized logging system for cmpDesk.
 * 
 * Features:
 * - Structured logging with scopes (AUTH, API, PLAYWRIGHT, etc.)
 * - Environment-aware (DEV vs PROD)
 * - Log level filtering (debug, info, warn, error)
 * - Sensitive data masking
 * - In-memory log buffer for future Debug Panel
 * 
 * Usage:
 *   import { logDebug, logInfo, logWarn, logError } from '@/lib/logger';
 *   
 *   logDebug('AUTH', 'Session created', { userId: '123' });
 *   logInfo('API', 'Request sent', { endpoint: '/dossier' });
 *   logWarn('SESSION', 'Session expiring soon');
 *   logError('PLAYWRIGHT', 'Navigation failed', error);
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogScope = 
  | 'AUTH'
  | 'SESSION'
  | 'PLAYWRIGHT'
  | 'API'
  | 'STORAGE'
  | 'UI'
  | 'SYSTEM'
  | 'IPC'
  | 'DB'
  | 'AURA'
  | 'XECM'
  | string; // Allow custom scopes

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: LogScope;
  message: string;
  data?: unknown;
  error?: Error | unknown;
}

export interface LoggerConfig {
  env: 'DEV' | 'PROD';
  debugLogs: boolean;
  logLevel: LogLevel;
  maxBufferSize: number;
}

// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================

/**
 * List of field names that should be masked in logs.
 * Case-insensitive matching.
 */
const SENSITIVE_FIELDS = new Set([
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'passwd',
  'secret',
  'apikey',
  'api_key',
  'cookie',
  'cookies',
  'authorization',
  'auth',
  'credentials',
  'credential',
  'sid',
  'sessionid',
  'session_id',
  'otdsticket',
  'otds_ticket',
  'fwuid',
  'aura.token',
  'aura.context',
  '.aspxauth',
  'ee-authenticated',
  'ssn',
  'sin',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'pin',
]);

/**
 * Regex patterns for sensitive data that might appear in values.
 */
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // OTDS tokens
  /\*OTDSSSO\*[A-Za-z0-9+/=]+/g,
  // Base64 encoded credentials (basic auth)
  /Basic\s+[A-Za-z0-9+/=]+/gi,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9_-]+/gi,
];

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get environment variable with fallback.
 * Works in both Node.js and browser environments.
 */
function getEnvVar(key: string, defaultValue: string): string {
  // Node.js environment (Electron main process)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? defaultValue;
  }
  // Browser environment (Vite injects import.meta.env)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[`VITE_${key}`] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Load configuration from environment variables.
 */
function loadConfig(): LoggerConfig {
  const env = getEnvVar('ENV', 'DEV') as 'DEV' | 'PROD';
  const debugLogs = getEnvVar('DEBUG_LOGS', 'true') === 'true';
  const logLevel = getEnvVar('LOG_LEVEL', 'debug') as LogLevel;
  
  return {
    env,
    debugLogs,
    logLevel,
    maxBufferSize: 1000, // Max entries to keep in memory
  };
}

// Global config (loaded once)
let config: LoggerConfig = loadConfig();

/**
 * Update logger configuration at runtime.
 * Useful for toggling debug mode from UI.
 */
export function setLoggerConfig(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current logger configuration.
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
  return { ...config };
}

// ============================================================================
// LOG LEVEL HIERARCHY
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be displayed based on current config.
 */
function shouldLog(level: LogLevel): boolean {
  // In PROD, only warn and error are allowed
  if (config.env === 'PROD' && (level === 'debug' || level === 'info')) {
    return false;
  }
  
  // Check DEBUG_LOGS flag for debug level
  if (level === 'debug' && !config.debugLogs) {
    return false;
  }
  
  // Check log level threshold
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.logLevel];
}

// ============================================================================
// SENSITIVE DATA MASKING
// ============================================================================

/**
 * Recursively mask sensitive data in an object.
 */
function maskSensitiveData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';
  
  // Handle null/undefined
  if (data === null || data === undefined) return data;
  
  // Handle primitives
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return maskSensitiveString(data);
    }
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, depth + 1));
  }
  
  // Handle objects
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();
    
    // Check if key is sensitive
    if (SENSITIVE_FIELDS.has(keyLower)) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 0) {
      masked[key] = maskSensitiveString(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

/**
 * Mask sensitive patterns in a string.
 */
function maskSensitiveString(str: string): string {
  let result = str;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  
  return result;
}

// ============================================================================
// LOG BUFFER (for Debug Panel)
// ============================================================================

const logBuffer: LogEntry[] = [];

/**
 * Add entry to log buffer.
 */
function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  
  // Trim buffer if too large
  if (logBuffer.length > config.maxBufferSize) {
    logBuffer.splice(0, logBuffer.length - config.maxBufferSize);
  }
}

/**
 * Get all buffered log entries.
 * Useful for Debug Panel UI.
 */
export function getLogBuffer(): ReadonlyArray<LogEntry> {
  return [...logBuffer];
}

/**
 * Clear the log buffer.
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Get log entries filtered by criteria.
 */
export function filterLogs(options: {
  level?: LogLevel;
  scope?: LogScope;
  since?: Date;
  limit?: number;
}): LogEntry[] {
  let filtered = [...logBuffer];
  
  if (options.level) {
    const minPriority = LOG_LEVEL_PRIORITY[options.level];
    filtered = filtered.filter(e => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
  }
  
  if (options.scope) {
    filtered = filtered.filter(e => e.scope === options.scope);
  }
  
  if (options.since) {
    const sinceTime = options.since.getTime();
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
  }
  
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(-options.limit);
  }
  
  return filtered;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format timestamp for log output.
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

/**
 * Format log message for console output.
 */
function formatMessage(level: LogLevel, scope: LogScope, message: string): string {
  const timestamp = formatTimestamp();
  const levelTag = level.toUpperCase().padEnd(5);
  return `${timestamp} [${levelTag}] [${scope}] ${message}`;
}

/**
 * Get console method for log level.
 */
function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'debug':
      return console.debug.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
      return console.error.bind(console);
    default:
      return console.log.bind(console);
  }
}

/**
 * Get ANSI color code for log level (Node.js/Electron main process).
 */
function getLevelColor(level: LogLevel): string {
  // Only use colors in Node.js environment
  if (typeof process === 'undefined' || !process.stdout?.isTTY) {
    return '';
  }
  
  switch (level) {
    case 'debug':
      return '\x1b[36m'; // Cyan
    case 'info':
      return '\x1b[32m'; // Green
    case 'warn':
      return '\x1b[33m'; // Yellow
    case 'error':
      return '\x1b[31m'; // Red
    default:
      return '';
  }
}

/**
 * ANSI reset code.
 */
function getResetColor(): string {
  if (typeof process === 'undefined' || !process.stdout?.isTTY) {
    return '';
  }
  return '\x1b[0m';
}

// ============================================================================
// CORE LOG FUNCTION
// ============================================================================

/**
 * Internal log function.
 */
function log(
  level: LogLevel,
  scope: LogScope,
  message: string,
  data?: unknown,
  error?: Error | unknown
): void {
  // Check if this log should be displayed
  if (!shouldLog(level)) {
    return;
  }
  
  // Create log entry
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    data: data !== undefined ? maskSensitiveData(data) : undefined,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  };
  
  // Add to buffer
  addToBuffer(entry);
  
  // Format and output
  const color = getLevelColor(level);
  const reset = getResetColor();
  const formattedMessage = formatMessage(level, scope, message);
  const consoleMethod = getConsoleMethod(level);
  
  // Build output
  if (color) {
    // Colored output for terminal
    if (entry.data !== undefined && entry.error) {
      consoleMethod(`${color}${formattedMessage}${reset}`, entry.data, entry.error);
    } else if (entry.data !== undefined) {
      consoleMethod(`${color}${formattedMessage}${reset}`, entry.data);
    } else if (entry.error) {
      consoleMethod(`${color}${formattedMessage}${reset}`, entry.error);
    } else {
      consoleMethod(`${color}${formattedMessage}${reset}`);
    }
  } else {
    // Plain output for browser
    if (entry.data !== undefined && entry.error) {
      consoleMethod(formattedMessage, entry.data, entry.error);
    } else if (entry.data !== undefined) {
      consoleMethod(formattedMessage, entry.data);
    } else if (entry.error) {
      consoleMethod(formattedMessage, entry.error);
    } else {
      consoleMethod(formattedMessage);
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Log a debug message.
 * Only shown in DEV mode with DEBUG_LOGS=true and LOG_LEVEL=debug.
 * 
 * @param scope - Log scope (AUTH, API, PLAYWRIGHT, etc.)
 * @param message - Human-readable message
 * @param data - Optional structured data
 */
export function logDebug(scope: LogScope, message: string, data?: unknown): void {
  log('debug', scope, message, data);
}

/**
 * Log an info message.
 * Shown in DEV mode when LOG_LEVEL is debug or info.
 * 
 * @param scope - Log scope (AUTH, API, PLAYWRIGHT, etc.)
 * @param message - Human-readable message
 * @param data - Optional structured data
 */
export function logInfo(scope: LogScope, message: string, data?: unknown): void {
  log('info', scope, message, data);
}

/**
 * Log a warning message.
 * Shown when LOG_LEVEL is debug, info, or warn.
 * 
 * @param scope - Log scope (AUTH, API, PLAYWRIGHT, etc.)
 * @param message - Human-readable message
 * @param data - Optional structured data
 */
export function logWarn(scope: LogScope, message: string, data?: unknown): void {
  log('warn', scope, message, data);
}

/**
 * Log an error message.
 * Always shown regardless of LOG_LEVEL.
 * 
 * @param scope - Log scope (AUTH, API, PLAYWRIGHT, etc.)
 * @param message - Human-readable message
 * @param error - Optional error object or additional data
 */
export function logError(scope: LogScope, message: string, error?: Error | unknown): void {
  log('error', scope, message, undefined, error);
}

/**
 * Create a scoped logger with a preset scope.
 * Useful for modules that always log with the same scope.
 * 
 * @param scope - Log scope to use for all messages
 * @returns Object with debug, info, warn, error methods
 * 
 * @example
 * const log = createScopedLogger('AUTH');
 * log.info('Session created');
 * log.error('Login failed', error);
 */
export function createScopedLogger(scope: LogScope) {
  return {
    debug: (message: string, data?: unknown) => logDebug(scope, message, data),
    info: (message: string, data?: unknown) => logInfo(scope, message, data),
    warn: (message: string, data?: unknown) => logWarn(scope, message, data),
    error: (message: string, error?: Error | unknown) => logError(scope, message, error),
  };
}

// ============================================================================
// EXPORTS (Default instance for convenience)
// ============================================================================

export default {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  scoped: createScopedLogger,
  getBuffer: getLogBuffer,
  clearBuffer: clearLogBuffer,
  filterLogs,
  setConfig: setLoggerConfig,
  getConfig: getLoggerConfig,
};
