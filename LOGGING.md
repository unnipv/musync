# Musync Logging System

This document explains the logging system implemented in Musync to control log output in different environments.

## Overview

Musync uses a centralized logging utility that:
- Controls log verbosity based on environment
- Formats log messages consistently
- Prevents excessive logging in production environments
- Provides different log levels for different types of information

## Log Levels

The logger supports the following log levels (in order of verbosity):

1. `debug` - Detailed information for debugging purposes (never shown in production by default)
2. `info` - General information about application operation
3. `warn` - Warning messages about potential issues
4. `error` - Error messages when things go wrong
5. `none` - No logging at all

## Configuration

The log level is configured using the `LOG_LEVEL` environment variable in your `.env` file:

```
# Options: debug, info, warn, error, none
LOG_LEVEL=error  # Only show errors in production
```

If not specified, the default log level is:
- `debug` in development environments
- `error` in production environments

## Usage

In your code, import the logger from `@/lib/logger` and use the appropriate methods:

```typescript
import logger from '@/lib/logger';

// Different log levels
logger.debug('Detailed debug information', { someData: 123 });  // Only in dev
logger.info('General information');                             // General info
logger.warn('Warning about potential issue');                   // Warnings
logger.error('Error occurred', new Error('Something failed'));  // Errors
```

## Best Practices

1. **Use the right log level**:
   - Use `debug` for developer-oriented details
   - Use `info` for general operational information
   - Use `warn` for issues that don't break functionality
   - Use `error` for actual errors that need attention

2. **Include context**:
   - Add relevant data objects as the second parameter
   - Include enough information to understand the context

3. **Avoid logging sensitive information**:
   - Never log authentication tokens, passwords, or sensitive user data
   - If needed, mask sensitive data (e.g., only show first/last few characters)

4. **Performance considerations**:
   - Avoid expensive operations in log messages
   - Remember that string concatenation happens even if the log level is filtered out

## Example

```typescript
// Good practice
logger.info(`User ${userId.slice(0, 4)}... logged in`, { 
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// Bad practice - contains sensitive data
logger.info(`User logged in with token: ${fullAuthToken}`);
```

## Converting from console.log

A utility script is included to help convert existing `console.log` statements to the new logger:

```bash
node scripts/update-logger.js
```

This script identifies files containing console statements and provides guidance on updating them. 