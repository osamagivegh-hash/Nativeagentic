// ===========================================
// NEXUS AI PLATFORM - AUDIT SERVICE
// Full audit trail and explainability
// ===========================================

import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { logger, auditLogger } from '../utils/logger.js';
import { db, query } from '../database/connection.js';
import {
  AuditLog,
  AIDecisionLog,
  Intent,
  TaskPlan,
  AgentResult,
  Explanation,
  UUID,
  JSONObject
} from '../types/index.js';

// ===========================================
// AUDIT SERVICE CLASS
// ===========================================

export class AuditService {
  // ===========================================
  // GENERAL AUDIT LOGGING
  // ===========================================

  async log(params: {
    userId?: UUID;
    sessionId?: UUID;
    action: string;
    resource: string;
    resourceId?: UUID;
    details?: JSONObject;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UUID> {
    const id = uuidv4();

    await db.insert('audit_logs', {
      id,
      user_id: params.userId || null,
      session_id: params.sessionId || null,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      details: JSON.stringify(params.details || {}),
      ai_decision: null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      created_at: new Date()
    });

    // Also log to audit logger for external systems
    auditLogger.info({
      auditId: id,
      ...params
    }, `Audit: ${params.action} on ${params.resource}`);

    return id;
  }

  // ===========================================
  // AI DECISION LOGGING
  // ===========================================

  async logAIDecision(params: {
    taskId: UUID;
    userId: UUID;
    sessionId: UUID;
    intent: Intent;
    plan: TaskPlan;
    results: AgentResult[];
    explanation: Explanation;
  }): Promise<UUID> {
    const id = uuidv4();

    const aiDecision: AIDecisionLog = {
      taskId: params.taskId,
      intent: params.intent,
      plan: params.plan,
      execution: {
        status: params.results.every(r => r.status === 'success') ? 'completed' : 'failed',
        agentsInvolved: [...new Set(params.results.map(r => r.agentType))],
        toolsUsed: [...new Set(params.results.flatMap(r => r.toolsUsed.map(t => t.toolName)))],
        totalDuration: params.results.reduce((sum, r) => sum + r.duration, 0),
        totalTokens: params.results.reduce((sum, r) => sum + r.tokensUsed, 0),
        retryCount: 0
      },
      explanation: params.explanation
    };

    await db.insert('audit_logs', {
      id,
      user_id: params.userId,
      session_id: params.sessionId,
      action: 'ai_decision',
      resource: 'task',
      resource_id: params.taskId,
      details: JSON.stringify({
        intentCategory: params.intent.category,
        planComplexity: params.plan.complexity,
        resultStatus: aiDecision.execution.status
      }),
      ai_decision: JSON.stringify(aiDecision),
      created_at: new Date()
    });

    // Detailed audit log
    auditLogger.info({
      auditId: id,
      taskId: params.taskId,
      userId: params.userId,
      intent: params.intent.normalizedQuery,
      category: params.intent.category,
      complexity: params.plan.complexity,
      agents: aiDecision.execution.agentsInvolved,
      tools: aiDecision.execution.toolsUsed,
      status: aiDecision.execution.status,
      confidence: params.explanation.confidence,
      duration: aiDecision.execution.totalDuration
    }, 'AI Decision logged');

    return id;
  }

  // ===========================================
  // ERROR LOGGING
  // ===========================================

  async logError(params: {
    taskId?: UUID;
    userId?: UUID;
    error: Error;
    context?: JSONObject;
  }): Promise<UUID> {
    const id = uuidv4();

    await db.insert('audit_logs', {
      id,
      user_id: params.userId || null,
      session_id: null,
      action: 'error',
      resource: params.taskId ? 'task' : 'system',
      resource_id: params.taskId || null,
      details: JSON.stringify({
        errorName: params.error.name,
        errorMessage: params.error.message,
        errorStack: params.error.stack,
        context: params.context
      }),
      created_at: new Date()
    });

    auditLogger.error({
      auditId: id,
      taskId: params.taskId,
      userId: params.userId,
      error: {
        name: params.error.name,
        message: params.error.message
      }
    }, 'Error logged');

    return id;
  }

  // ===========================================
  // RETRIEVAL
  // ===========================================

  async getAuditLogs(params: {
    userId?: UUID;
    action?: string;
    resource?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    let whereClause = '1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      queryParams.push(params.userId);
    }
    if (params.action) {
      whereClause += ` AND action = $${paramIndex++}`;
      queryParams.push(params.action);
    }
    if (params.resource) {
      whereClause += ` AND resource = $${paramIndex++}`;
      queryParams.push(params.resource);
    }
    if (params.from) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(params.from);
    }
    if (params.to) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(params.to);
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const [logsResult, countResult] = await Promise.all([
      query(`
        SELECT * FROM audit_logs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, queryParams),
      query(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE ${whereClause}
      `, queryParams)
    ]);

    return {
      logs: logsResult.rows.map(this.rowToAuditLog),
      total: parseInt((countResult.rows[0] as any).count)
    };
  }

  async getAIDecisions(params: {
    userId?: UUID;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<AIDecisionLog[]> {
    let whereClause = "action = 'ai_decision' AND ai_decision IS NOT NULL";
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      queryParams.push(params.userId);
    }
    if (params.from) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(params.from);
    }
    if (params.to) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(params.to);
    }

    const result = await query(`
      SELECT ai_decision FROM audit_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${params.limit || 50}
    `, queryParams);

    return result.rows.map((r: any) => JSON.parse(r.ai_decision));
  }

  async getDecisionExplanation(taskId: UUID): Promise<Explanation | null> {
    const result = await query(`
      SELECT ai_decision FROM audit_logs
      WHERE action = 'ai_decision' AND resource_id = $1
      LIMIT 1
    `, [taskId]);

    if (result.rows.length === 0) return null;

    const aiDecision = JSON.parse((result.rows[0] as any).ai_decision) as AIDecisionLog;
    return aiDecision.explanation;
  }

  // ===========================================
  // ANALYTICS
  // ===========================================

  async getAuditStats(from: Date, to: Date): Promise<{
    totalActions: number;
    aiDecisions: number;
    errors: number;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
    activityByHour: Array<{ hour: number; count: number }>;
  }> {
    const [totalResult, aiResult, errorResult, actionsResult, resourcesResult, hourlyResult] = await Promise.all([
      query(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
      `, [from, to]),
      query(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE action = 'ai_decision'
          AND created_at >= $1 AND created_at <= $2
      `, [from, to]),
      query(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE action = 'error'
          AND created_at >= $1 AND created_at <= $2
      `, [from, to]),
      query(`
        SELECT action, COUNT(*) as count FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `, [from, to]),
      query(`
        SELECT resource, COUNT(*) as count FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY resource
        ORDER BY count DESC
        LIMIT 10
      `, [from, to]),
      query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY hour
        ORDER BY hour
      `, [from, to])
    ]);

    return {
      totalActions: parseInt((totalResult.rows[0] as any).count),
      aiDecisions: parseInt((aiResult.rows[0] as any).count),
      errors: parseInt((errorResult.rows[0] as any).count),
      topActions: actionsResult.rows.map((r: any) => ({
        action: r.action,
        count: parseInt(r.count)
      })),
      topResources: resourcesResult.rows.map((r: any) => ({
        resource: r.resource,
        count: parseInt(r.count)
      })),
      activityByHour: hourlyResult.rows.map((r: any) => ({
        hour: parseInt(r.hour),
        count: parseInt(r.count)
      }))
    };
  }

  // ===========================================
  // MAINTENANCE
  // ===========================================

  async pruneOldLogs(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - config.auditRetentionDays);

    const result = await query(`
      DELETE FROM audit_logs
      WHERE created_at < $1
    `, [retentionDate]);

    const count = result.rowCount || 0;
    logger.info({ count, retentionDays: config.auditRetentionDays }, 'Pruned old audit logs');
    return count;
  }

  async exportLogs(from: Date, to: Date): Promise<AuditLog[]> {
    const result = await query(`
      SELECT * FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at ASC
    `, [from, to]);

    return result.rows.map(this.rowToAuditLog);
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private rowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      timestamp: row.created_at,
      userId: row.user_id,
      sessionId: row.session_id,
      action: row.action,
      resource: row.resource,
      details: {
        input: row.details ? JSON.parse(row.details) : {},
        output: {},
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      },
      aiDecision: row.ai_decision ? JSON.parse(row.ai_decision) : undefined
    };
  }
}

// ===========================================
// SINGLETON
// ===========================================

let instance: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!instance) {
    instance = new AuditService();
  }
  return instance;
}






