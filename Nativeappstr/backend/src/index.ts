// ===========================================
// NEXUS AI PLATFORM - MAIN ENTRY POINT
// AI-Native Agentic Application Server
// ===========================================

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { config, serverConfig, redisConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { pool, checkDatabaseConnection, closeDatabaseConnection } from './database/connection.js';
import { registerRoutes } from './routes/index.js';
import { AIOrchestrator } from './orchestrator/index.js';
import { AgentRegistry } from './agents/registry.js';
import { createMemoryManager } from './memory/manager.js';
import { getToolRegistry } from './tools/registry.js';
import { getAuditService } from './services/audit.js';
import { getProactiveIntelligence } from './services/proactive-intelligence.js';
import { User, UserRole } from './types/index.js';

// ===========================================
// FASTIFY INSTANCE
// ===========================================

const app = Fastify({
  logger: false, // We use our own logger
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId'
});

// ===========================================
// MIDDLEWARE SETUP
// ===========================================

async function setupMiddleware(): Promise<void> {
  // CORS
  await app.register(cors, {
    origin: serverConfig.nodeEnv === 'production' 
      ? ['https://yourdomain.com'] 
      : true,
    credentials: true
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: serverConfig.nodeEnv === 'production'
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs
  });

  // JWT authentication
  await app.register(jwt, {
    secret: config.jwtSecret
  });

  // Request logging
  app.addHook('onRequest', async (request, reply) => {
    logger.info({
      method: request.method,
      url: request.url,
      requestId: request.id
    }, 'Incoming request');
  });

  // Response logging
  app.addHook('onResponse', async (request, reply) => {
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime
    }, 'Request completed');
  });

  // Authentication decorator (simplified for demo)
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);

  // Auth hook (skip for health check)
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/api/public')) {
      return;
    }

    // For demo purposes, create a mock user
    // In production, verify JWT token
    const mockUser: User = {
      id: 'user-001',
      email: 'demo@nexus.ai',
      name: 'Demo User',
      role: 'analyst' as UserRole,
      permissions: [
        'read_financial_data',
        'read_user_data',
        'read_metrics',
        'read_rules',
        'read_compliance',
        'analyze_data',
        'analyze_users',
        'assess_risk',
        'check_compliance',
        'generate_reports',
        'manage_alerts',
        'execute_operations',
        'read_system_health'
      ],
      preferences: {
        timezone: 'UTC',
        language: 'en',
        notificationChannels: ['email'],
        dashboardLayout: {},
        aiInteractionStyle: 'detailed'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (request as any).user = mockUser;
    (request as any).sessionId = request.headers['x-session-id'] || `session-${Date.now()}`;
  });
}

// ===========================================
// SERVICES INITIALIZATION
// ===========================================

async function initializeServices(): Promise<{
  orchestrator: AIOrchestrator;
  memoryManager: Awaited<ReturnType<typeof createMemoryManager>>;
}> {
  // Check database connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    throw new Error('Failed to connect to database');
  }
  logger.info('Database connection verified');

  // Initialize memory manager
  const memoryManager = await createMemoryManager(
    redisConfig.url,
    redisConfig.prefix
  );
  logger.info('Memory manager initialized');

  // Initialize tool registry
  const toolRegistry = getToolRegistry();
  logger.info({ tools: toolRegistry.getToolNames().length }, 'Tool registry initialized');

  // Initialize agent registry
  const agentRegistry = new AgentRegistry(toolRegistry);
  logger.info({ agents: agentRegistry.getAllAgentTypes() }, 'Agent registry initialized');

  // Initialize audit service
  const auditService = getAuditService();
  logger.info('Audit service initialized');

  // Initialize AI orchestrator
  const orchestrator = new AIOrchestrator(
    agentRegistry,
    memoryManager,
    auditService
  );
  logger.info('AI Orchestrator initialized');

  // Start proactive intelligence (if enabled)
  if (config.proactiveEnabled) {
    const proactiveService = getProactiveIntelligence();
    proactiveService.start();
    logger.info('Proactive Intelligence Service started');
  }

  return { orchestrator, memoryManager };
}

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  // Stop proactive intelligence
  const proactiveService = getProactiveIntelligence();
  proactiveService.stop();

  // Close database connections
  await closeDatabaseConnection();

  // Close Fastify
  await app.close();

  logger.info('Shutdown complete');
  process.exit(0);
}

// ===========================================
// MAIN STARTUP
// ===========================================

async function main(): Promise<void> {
  try {
    logger.info('===========================================');
    logger.info('   NEXUS AI PLATFORM - Starting Server    ');
    logger.info('===========================================');

    // Setup middleware
    await setupMiddleware();
    logger.info('Middleware configured');

    // Initialize services
    const { orchestrator, memoryManager } = await initializeServices();

    // Register routes
    await registerRoutes(app, orchestrator, memoryManager);

    // Start server
    await app.listen({
      port: serverConfig.port,
      host: serverConfig.host
    });

    logger.info(`
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║   🚀 NEXUS AI PLATFORM                           ║
    ║                                                   ║
    ║   Server running at:                             ║
    ║   http://${serverConfig.host}:${serverConfig.port}                      ║
    ║                                                   ║
    ║   Environment: ${serverConfig.nodeEnv.padEnd(31)}║
    ║   Proactive AI: ${config.proactiveEnabled ? 'Enabled ' : 'Disabled'}                      ║
    ║   Audit: ${config.auditEnabled ? 'Enabled ' : 'Disabled'}                              ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
    `);

    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the application
main();






