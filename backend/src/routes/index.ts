// ===========================================
// NEXUS AI PLATFORM - API ROUTES
// ===========================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { AIOrchestrator } from '../orchestrator/index.js';
import { AgentRegistry } from '../agents/registry.js';
import { MemoryManager } from '../memory/manager.js';
import { getAuditService } from '../services/audit.js';
import { getProactiveIntelligence } from '../services/proactive-intelligence.js';
import { getToolRegistry } from '../tools/registry.js';
import {
  ChatRequest,
  ChatRequestSchema,
  ApprovalRequest,
  ApprovalRequestSchema,
  User,
  UserRole
} from '../types/index.js';
import { logger } from '../utils/logger.js';

// ===========================================
// ROUTE REGISTRATION
// ===========================================

export async function registerRoutes(
  app: FastifyInstance,
  orchestrator: AIOrchestrator,
  memoryManager: MemoryManager
): Promise<void> {
  const auditService = getAuditService();
  const proactiveService = getProactiveIntelligence();

  // ===========================================
  // HEALTH CHECK
  // ===========================================

  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

  // ===========================================
  // CHAT / CONVERSATION API
  // ===========================================

  app.post('/api/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ChatRequestSchema.parse(request.body);
    const user = (request as any).user as User;
    const sessionId = (request as any).sessionId || uuidv4();

    try {
      // Store user message in memory
      await memoryManager.storeConversationTurn(
        sessionId,
        user.id,
        body.message,
        'user'
      );

      // Get conversation history
      const history = await memoryManager.getConversationContext(sessionId, 10);
      const conversationHistory = history.map(h => ({
        id: h.id,
        role: h.type.includes('user') ? 'user' as const : 'assistant' as const,
        content: h.content,
        timestamp: h.createdAt
      }));

      // Process through orchestrator
      const result = await orchestrator.process(
        body.message,
        user,
        sessionId,
        conversationHistory
      );

      // Store assistant response
      await memoryManager.storeConversationTurn(
        sessionId,
        user.id,
        result.response,
        'assistant'
      );

      // Audit log
      await auditService.log({
        userId: user.id,
        sessionId,
        action: 'chat',
        resource: 'conversation',
        resourceId: result.taskId,
        details: {
          status: result.status,
          agentsUsed: result.metadata.agentsUsed,
          duration: result.metadata.duration
        }
      });

      return {
        success: true,
        data: {
          taskId: result.taskId,
          response: result.response,
          status: result.status,
          explanation: result.explanation,
          metadata: {
            duration: result.metadata.duration,
            agentsUsed: result.metadata.agentsUsed,
            confidenceScores: result.metadata.confidenceScores
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'Chat endpoint error');
      
      await auditService.logError({
        userId: user.id,
        error: error instanceof Error ? error : new Error(String(error))
      });

      reply.status(500);
      return {
        success: false,
        error: {
          code: 'CHAT_ERROR',
          message: error instanceof Error ? error.message : 'An error occurred'
        }
      };
    }
  });

  // ===========================================
  // TASK MANAGEMENT
  // ===========================================

  app.get('/api/tasks/:taskId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    const user = (request as any).user as User;

    // TODO: Implement task retrieval from database
    return {
      success: true,
      data: {
        taskId,
        status: 'completed',
        message: 'Task details would be retrieved here'
      }
    };
  });

  app.post('/api/tasks/:taskId/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    const body = ApprovalRequestSchema.parse(request.body);
    const user = (request as any).user as User;

    await auditService.log({
      userId: user.id,
      action: body.approved ? 'approve_task' : 'reject_task',
      resource: 'task',
      resourceId: taskId,
      details: {
        comments: body.comments,
        modifications: body.modifications
      }
    });

    return {
      success: true,
      data: {
        taskId,
        approved: body.approved,
        message: body.approved ? 'Task approved' : 'Task rejected'
      }
    };
  });

  // ===========================================
  // INSIGHTS API
  // ===========================================

  app.get('/api/insights', async (request: FastifyRequest, reply: FastifyReply) => {
    const { type, limit = '20' } = request.query as { type?: string; limit?: string };
    
    let insights;
    if (type) {
      insights = await proactiveService.getInsightsByType(type as any, parseInt(limit));
    } else {
      insights = await proactiveService.getRecentInsights(parseInt(limit));
    }

    return {
      success: true,
      data: { insights }
    };
  });

  app.post('/api/insights/:insightId/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const { insightId } = request.params as { insightId: string };
    const user = (request as any).user as User;

    await proactiveService.acknowledgeInsight(insightId, user.id);

    await auditService.log({
      userId: user.id,
      action: 'acknowledge_insight',
      resource: 'insight',
      resourceId: insightId
    });

    return {
      success: true,
      data: { acknowledged: true }
    };
  });

  // ===========================================
  // AUDIT API
  // ===========================================

  app.get('/api/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as User;
    const { action, resource, from, to, limit = '50', offset = '0' } = request.query as Record<string, string>;

    // Only admins can view all logs
    const userId = user.role === 'admin' ? undefined : user.id;

    const result = await auditService.getAuditLogs({
      userId,
      action,
      resource,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      success: true,
      data: result
    };
  });

  app.get('/api/audit/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const stats = await auditService.getAuditStats(fromDate, toDate);

    return {
      success: true,
      data: stats
    };
  });

  app.get('/api/audit/decisions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as User;
    const { from, to, limit = '20' } = request.query as Record<string, string>;

    const decisions = await auditService.getAIDecisions({
      userId: user.role === 'admin' ? undefined : user.id,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: parseInt(limit)
    });

    return {
      success: true,
      data: { decisions }
    };
  });

  app.get('/api/audit/explanation/:taskId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };

    const explanation = await auditService.getDecisionExplanation(taskId);

    if (!explanation) {
      reply.status(404);
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Explanation not found' }
      };
    }

    return {
      success: true,
      data: { explanation }
    };
  });

  // ===========================================
  // AGENTS API
  // ===========================================

  app.get('/api/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const toolRegistry = getToolRegistry();
    const agentRegistry = new AgentRegistry(toolRegistry);

    const agents = agentRegistry.getAllAgentTypes().map(type => {
      const config = agentRegistry.getAgentConfig(type);
      return {
        type,
        name: config.name,
        description: config.description,
        capabilities: config.capabilities,
        tools: config.tools
      };
    });

    return {
      success: true,
      data: { agents }
    };
  });

  // ===========================================
  // TOOLS API
  // ===========================================

  app.get('/api/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    const toolRegistry = getToolRegistry();
    const tools = toolRegistry.describeTools();

    return {
      success: true,
      data: { tools }
    };
  });

  // ===========================================
  // MEMORY API
  // ===========================================

  app.get('/api/memory/user', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as User;
    const { query: searchQuery, limit = '10' } = request.query as { query?: string; limit?: string };

    let memories;
    if (searchQuery) {
      memories = await memoryManager.getUserMemories(user.id, searchQuery, parseInt(limit));
    } else {
      memories = await memoryManager.retrieve({
        layer: 'user',
        filters: { userId: user.id },
        limit: parseInt(limit)
      });
    }

    return {
      success: true,
      data: { memories }
    };
  });

  app.get('/api/memory/domain/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { category, active = 'true' } = request.query as { category?: string; active?: string };

    const rules = await memoryManager.getRelevantDomainRules(category || '');

    return {
      success: true,
      data: { 
        rules: active === 'true' ? rules.filter(r => r.isActive) : rules 
      }
    };
  });

  // ===========================================
  // DASHBOARD API
  // ===========================================

  app.get('/api/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as User;

    // Get recent insights
    const insights = await proactiveService.getRecentInsights(5);

    // Get audit stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const auditStats = await auditService.getAuditStats(weekAgo, now);

    // Get recent AI decisions
    const recentDecisions = await auditService.getAIDecisions({
      userId: user.role === 'admin' ? undefined : user.id,
      limit: 5
    });

    return {
      success: true,
      data: {
        insights,
        stats: {
          totalActions: auditStats.totalActions,
          aiDecisions: auditStats.aiDecisions,
          errors: auditStats.errors,
          topActions: auditStats.topActions.slice(0, 5)
        },
        recentDecisions: recentDecisions.map(d => ({
          taskId: d.taskId,
          intent: d.intent.normalizedQuery,
          status: d.execution.status,
          confidence: d.explanation.confidence,
          agents: d.execution.agentsInvolved
        }))
      }
    };
  });

  logger.info('API routes registered');
}






