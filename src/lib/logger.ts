/**
 * Logger utility for Musync application
 * Controls logging behavior based on environment
 */

// Default log level based on environment
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? 'error' 
  : 'debug';

// Log levels in order of verbosity
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// Current log level (can be overridden via environment variable)
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL;

// Flag to determine if we're in a production environment
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Determines if a message should be logged based on its level and the current log level setting
 * 
 * @param level - The level of the log message
 * @returns Whether the message should be logged
 */
const shouldLog = (level: keyof typeof LOG_LEVELS): boolean => {
  // Convert level names to numeric values for comparison
  const currentLevelValue = LOG_LEVELS[CURRENT_LOG_LEVEL as keyof typeof LOG_LEVELS] || LOG_LEVELS.error;
  const messageLevelValue = LOG_LEVELS[level];
  
  // Log if message level is greater than or equal to the current level
  return messageLevelValue >= currentLevelValue;
};

/**
 * Creates a prefixed log message
 * 
 * @param message - The message to log
 * @param data - Optional data to include
 * @returns Formatted message with timestamp
 */
const formatMessage = (message: string, data?: any): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}`;
};

/**
 * Logger utility with multiple log levels
 */
export const logger = {
  /**
   * Check if current environment is production
   * 
   * @returns True if in production environment
   */
  isProduction: (): boolean => {
    return IS_PRODUCTION;
  },

  /**
   * Log debug message (only in non-production environments by default)
   * 
   * @param message - The message to log
   * @param data - Optional data to include with the log
   */
  debug: (message: string, data?: any): void => {
    if (shouldLog('debug')) {
      if (data !== undefined) {
        console.debug(formatMessage(message), data);
      } else {
        console.debug(formatMessage(message));
      }
    }
  },
  
  /**
   * Log informational message
   * 
   * @param message - The message to log
   * @param data - Optional data to include with the log
   */
  info: (message: string, data?: any): void => {
    if (shouldLog('info')) {
      if (data !== undefined) {
        console.log(formatMessage(message), data);
      } else {
        console.log(formatMessage(message));
      }
    }
  },
  
  /**
   * Log warning message
   * 
   * @param message - The message to log
   * @param data - Optional data to include with the log
   */
  warn: (message: string, data?: any): void => {
    if (shouldLog('warn')) {
      if (data !== undefined) {
        console.warn(formatMessage(message), data);
      } else {
        console.warn(formatMessage(message));
      }
    }
  },
  
  /**
   * Log error message (always logged, even in production)
   * 
   * @param message - The message to log
   * @param data - Optional data to include with the log
   */
  error: (message: string, data?: any): void => {
    if (shouldLog('error')) {
      if (data !== undefined) {
        console.error(formatMessage(message), data);
      } else {
        console.error(formatMessage(message));
      }
    }
  }
};

export default logger; 