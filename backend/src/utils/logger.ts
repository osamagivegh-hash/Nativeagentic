// ===========================================
// NEXUS AI PLATFORM - LOGGING SYSTEM
// ===========================================

import pino from 'pino';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Create base logger
export const logger = pino({
  level: config.logLevel,
  transport: config.logPretty ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  base: {
    service: 'nexus-ai',
    version: '1.0.0'
  },
  formatters: {
    level: (label) => ({ level: label })
  }
});

// Request-scoped logger
export function createRequestLogger(requestId?: string) {
  return logger.child({
    requestId: requestId || uuidv4()
  });
}

// Agent-scoped logger
export function createAgentLogger(agentType: string, taskId: string) {
  return logger.child({
    agentType,
    taskId
  });
}

// Task-scoped logger
export function createTaskLogger(taskId: string, userId: string) {
  return logger.child({
    taskId,
    userId
  });
}

// Audit logger - separate concern for compliance
export const auditLogger = pino({
  level: 'info',
  base: {
    type: 'audit'
  }
});

// Performance logger
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
) {
  logger.info({
    operation,
    duration,
    ...metadata
  }, `Performance: ${operation} completed in ${duration}ms`);
}

// AI Decision logger
export function logAIDecision(
  taskId: string,
  decision: {
    type: string;
    input: unknown;
    output: unknown;
    confidence: number;
    reasoning?: string;
  }
) {
  logger.info({
    taskId,
    aiDecision: decision
  }, `AI Decision: ${decision.type}`);
}

// Error with context
export function logError(
  error: Error,
  context: Record<string, unknown> = {}
) {
  logger.error({
    err: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...context
  }, error.message);
}

export default logger;






