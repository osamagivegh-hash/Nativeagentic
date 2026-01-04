// ===========================================
// NEXUS AI PLATFORM - ANALYSIS TOOLS
// Tools for data analysis and insights
// ===========================================

import { z } from 'zod';
import { Tool, ToolContext, ToolResult, JSONObject } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { query } from '../database/connection.js';

// ===========================================
// TOOL: Analyze Data
// ===========================================

const analyzeDataTool: Tool = {
  name: 'analyze_data',
  description: 'Perform general data analysis on datasets',
  category: 'database',
  inputSchema: z.object({
    dataType: z.enum(['financial', 'user', 'operations', 'custom']),
    analysisType: z.enum([
      'descriptive',
      'comparative',
      'correlation',
      'distribution',
      'segmentation'
    ]),
    dimensions: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    filters: z.record(z.unknown()).optional(),
    groupBy: z.string().optional()
  }),
  outputSchema: z.object({
    analysis: z.object({
      type: z.string(),
      results: z.unknown(),
      insights: z.array(z.string()),
      confidence: z.number()
    }),
    metadata: z.object({
      dataPoints: z.number(),
      processingTime: z.number()
    })
  }),
  requiresPermission: ['analyze_data'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { dataType, analysisType, filters, groupBy } = params as {
        dataType: string;
        analysisType: string;
        filters?: Record<string, unknown>;
        groupBy?: string;
      };

      let results: unknown;
      const insights: string[] = [];
      let dataPoints = 0;

      // Select table based on dataType
      const tableMap: Record<string, string> = {
        financial: 'financial_transactions',
        user: 'users',
        operations: 'metrics',
        custom: 'metrics'
      };
      const tableName = tableMap[dataType];

      switch (analysisType) {
        case 'descriptive': {
          const statsResult = await query(`
            SELECT 
              COUNT(*) as count,
              ${dataType === 'financial' ? `
                SUM(amount) as total,
                AVG(amount) as average,
                MIN(amount) as minimum,
                MAX(amount) as maximum,
                STDDEV(amount) as std_dev
              ` : `
                COUNT(*) as total
              `}
            FROM ${tableName}
          `);

          results = statsResult.rows[0];
          dataPoints = parseInt((results as any).count || '0');

          if (dataType === 'financial') {
            const avg = parseFloat((results as any).average || '0');
            const stdDev = parseFloat((results as any).std_dev || '0');
            
            if (stdDev > avg * 0.5) {
              insights.push('High variance detected in transaction amounts - consider investigating outliers');
            }
            if (dataPoints > 100) {
              insights.push(`Substantial dataset with ${dataPoints} data points provides reliable statistics`);
            }
          }
          break;
        }

        case 'comparative': {
          if (dataType === 'financial' && groupBy) {
            const compareResult = await query(`
              SELECT 
                ${groupBy},
                COUNT(*) as count,
                SUM(amount) as total,
                AVG(amount) as average
              FROM ${tableName}
              GROUP BY ${groupBy}
              ORDER BY total DESC
            `);

            results = compareResult.rows;
            dataPoints = compareResult.rows.length;

            if (compareResult.rows.length > 1) {
              const totals = compareResult.rows.map((r: any) => parseFloat(r.total));
              const max = Math.max(...totals);
              const min = Math.min(...totals);
              
              if (max > min * 3) {
                insights.push(`Significant disparity found: top ${groupBy} has ${(max/min).toFixed(1)}x more than bottom`);
              }
            }
          }
          break;
        }

        case 'distribution': {
          if (dataType === 'financial') {
            const distResult = await query(`
              SELECT 
                CASE 
                  WHEN amount < 100 THEN 'small'
                  WHEN amount < 1000 THEN 'medium'
                  WHEN amount < 10000 THEN 'large'
                  ELSE 'very_large'
                END as bucket,
                COUNT(*) as count,
                SUM(amount) as total
              FROM ${tableName}
              GROUP BY bucket
              ORDER BY 
                CASE bucket
                  WHEN 'small' THEN 1
                  WHEN 'medium' THEN 2
                  WHEN 'large' THEN 3
                  ELSE 4
                END
            `);

            results = distResult.rows;
            dataPoints = distResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

            const largeCount = distResult.rows.find((r: any) => r.bucket === 'very_large');
            if (largeCount && parseInt(largeCount.count) > dataPoints * 0.1) {
              insights.push('Notable concentration of very large transactions - may warrant review');
            }
          }
          break;
        }

        case 'segmentation': {
          if (dataType === 'user') {
            const segmentResult = await query(`
              SELECT 
                role,
                COUNT(*) as user_count,
                COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_count
              FROM users
              GROUP BY role
            `);

            results = segmentResult.rows;
            dataPoints = segmentResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.user_count), 0);

            for (const row of segmentResult.rows as any[]) {
              const activeRate = parseInt(row.active_count) / parseInt(row.user_count);
              if (activeRate < 0.3) {
                insights.push(`Low engagement in ${row.role} segment: only ${(activeRate * 100).toFixed(0)}% active`);
              }
            }
          }
          break;
        }

        case 'correlation': {
          // Simplified correlation analysis
          results = { correlations: [], note: 'Full correlation analysis requires additional data' };
          insights.push('Consider adding more dimensions for meaningful correlation analysis');
          break;
        }
      }

      return {
        success: true,
        data: {
          analysis: {
            type: analysisType,
            results,
            insights,
            confidence: dataPoints > 100 ? 0.9 : dataPoints > 20 ? 0.7 : 0.5
          },
          metadata: {
            dataPoints,
            processingTime: Date.now() - startTime
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'analyze_data failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }
};

// ===========================================
// TOOL: Analyze Behavior
// ===========================================

const analyzeBehaviorTool: Tool = {
  name: 'analyze_behavior',
  description: 'Analyze user behavior patterns and engagement',
  category: 'database',
  inputSchema: z.object({
    behaviorType: z.enum(['engagement', 'actions', 'patterns', 'journey']),
    userId: z.string().uuid().optional(),
    segment: z.string().optional(),
    timeRange: z.object({
      from: z.string(),
      to: z.string()
    }).optional()
  }),
  outputSchema: z.object({
    behavior: z.object({
      type: z.string(),
      patterns: z.array(z.object({
        pattern: z.string(),
        frequency: z.number(),
        significance: z.enum(['high', 'medium', 'low'])
      })),
      metrics: z.record(z.number()),
      recommendations: z.array(z.string())
    })
  }),
  requiresPermission: ['analyze_users'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { behaviorType, userId, timeRange } = params as {
        behaviorType: string;
        userId?: string;
        timeRange?: { from: string; to: string };
      };

      let whereClause = '1=1';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex++}`;
        queryParams.push(userId);
      }
      if (timeRange) {
        whereClause += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
        queryParams.push(timeRange.from, timeRange.to);
      }

      const patterns: Array<{ pattern: string; frequency: number; significance: 'high' | 'medium' | 'low' }> = [];
      const metrics: Record<string, number> = {};
      const recommendations: string[] = [];

      switch (behaviorType) {
        case 'engagement': {
          const engagementResult = await query(`
            SELECT 
              DATE_TRUNC('day', created_at) as day,
              COUNT(*) as actions,
              COUNT(DISTINCT user_id) as unique_users
            FROM audit_logs
            WHERE ${whereClause}
            GROUP BY day
            ORDER BY day DESC
            LIMIT 30
          `, queryParams);

          const rows = engagementResult.rows as any[];
          
          if (rows.length > 0) {
            const totalActions = rows.reduce((sum, r) => sum + parseInt(r.actions), 0);
            const avgDaily = totalActions / rows.length;
            
            metrics['total_actions'] = totalActions;
            metrics['avg_daily_actions'] = Math.round(avgDaily);
            metrics['days_analyzed'] = rows.length;

            if (avgDaily > 100) {
              patterns.push({ pattern: 'High activity level', frequency: avgDaily, significance: 'high' });
            }

            // Check for declining engagement
            if (rows.length >= 7) {
              const recentWeek = rows.slice(0, 7).reduce((sum, r) => sum + parseInt(r.actions), 0) / 7;
              const previousWeek = rows.slice(7, 14).reduce((sum, r) => sum + parseInt(r.actions), 0) / Math.min(7, rows.length - 7);
              
              if (previousWeek > 0 && recentWeek < previousWeek * 0.8) {
                patterns.push({ pattern: 'Declining engagement', frequency: Math.round((1 - recentWeek/previousWeek) * 100), significance: 'high' });
                recommendations.push('Consider re-engagement campaign for declining users');
              }
            }
          }
          break;
        }

        case 'actions': {
          const actionsResult = await query(`
            SELECT 
              action,
              COUNT(*) as count,
              COUNT(DISTINCT user_id) as unique_users
            FROM audit_logs
            WHERE ${whereClause}
            GROUP BY action
            ORDER BY count DESC
            LIMIT 20
          `, queryParams);

          const rows = actionsResult.rows as any[];
          const totalActions = rows.reduce((sum, r) => sum + parseInt(r.count), 0);

          for (const row of rows.slice(0, 5)) {
            const percentage = (parseInt(row.count) / totalActions) * 100;
            patterns.push({
              pattern: `${row.action}: ${percentage.toFixed(1)}% of actions`,
              frequency: parseInt(row.count),
              significance: percentage > 20 ? 'high' : percentage > 10 ? 'medium' : 'low'
            });
          }

          metrics['unique_actions'] = rows.length;
          metrics['total_actions'] = totalActions;
          break;
        }

        case 'patterns': {
          // Look for time-based patterns
          const hourlyResult = await query(`
            SELECT 
              EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as count
            FROM audit_logs
            WHERE ${whereClause}
            GROUP BY hour
            ORDER BY hour
          `, queryParams);

          const rows = hourlyResult.rows as any[];
          const maxHour = rows.reduce((max, r) => parseInt(r.count) > parseInt(max.count) ? r : max, rows[0]);
          
          if (maxHour) {
            patterns.push({
              pattern: `Peak activity at ${maxHour.hour}:00`,
              frequency: parseInt(maxHour.count),
              significance: 'high'
            });
          }
          break;
        }

        case 'journey': {
          // Simplified journey analysis
          patterns.push({
            pattern: 'Standard user journey detected',
            frequency: 1,
            significance: 'medium'
          });
          recommendations.push('Implement detailed journey tracking for more insights');
          break;
        }
      }

      return {
        success: true,
        data: {
          behavior: {
            type: behaviorType,
            patterns,
            metrics,
            recommendations
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'analyze_behavior failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Behavior analysis failed'
      };
    }
  }
};

// ===========================================
// TOOL: Risk Assessment
// ===========================================

const riskAssessmentTool: Tool = {
  name: 'risk_assessment',
  description: 'Assess risk levels for various business scenarios',
  category: 'database',
  inputSchema: z.object({
    entity: z.enum(['transaction', 'user', 'operation', 'compliance']),
    entityId: z.string().optional(),
    context: z.record(z.unknown()).optional(),
    factors: z.array(z.string()).optional()
  }),
  outputSchema: z.object({
    risk: z.object({
      level: z.enum(['critical', 'high', 'medium', 'low']),
      score: z.number(),
      factors: z.array(z.object({
        name: z.string(),
        impact: z.enum(['high', 'medium', 'low']),
        description: z.string()
      })),
      mitigations: z.array(z.string()),
      requiresAction: z.boolean()
    })
  }),
  requiresPermission: ['assess_risk'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { entity, entityId, context: assessmentContext } = params as {
        entity: string;
        entityId?: string;
        context?: Record<string, unknown>;
      };

      const factors: Array<{ name: string; impact: 'high' | 'medium' | 'low'; description: string }> = [];
      const mitigations: string[] = [];
      let score = 0;

      switch (entity) {
        case 'transaction': {
          if (entityId) {
            const txResult = await query(`
              SELECT amount, type, category FROM financial_transactions WHERE id = $1
            `, [entityId]);

            if (txResult.rows[0]) {
              const tx = txResult.rows[0] as any;
              const amount = parseFloat(tx.amount);

              if (amount > 10000) {
                factors.push({
                  name: 'High value transaction',
                  impact: 'high',
                  description: `Transaction amount ${amount} exceeds threshold`
                });
                score += 30;
                mitigations.push('Require additional approval for high-value transactions');
              }

              if (tx.type === 'withdrawal') {
                factors.push({
                  name: 'Outbound fund movement',
                  impact: 'medium',
                  description: 'Withdrawal transactions require extra scrutiny'
                });
                score += 15;
              }
            }
          }
          break;
        }

        case 'user': {
          if (entityId) {
            const userResult = await query(`
              SELECT u.*, COUNT(a.id) as recent_actions
              FROM users u
              LEFT JOIN audit_logs a ON a.user_id = u.id AND a.created_at > NOW() - INTERVAL '7 days'
              WHERE u.id = $1
              GROUP BY u.id
            `, [entityId]);

            if (userResult.rows[0]) {
              const user = userResult.rows[0] as any;
              
              if (user.role === 'admin') {
                factors.push({
                  name: 'Admin privileges',
                  impact: 'medium',
                  description: 'User has elevated system access'
                });
                score += 20;
              }

              if (parseInt(user.recent_actions) > 1000) {
                factors.push({
                  name: 'Unusual activity volume',
                  impact: 'high',
                  description: `${user.recent_actions} actions in past 7 days`
                });
                score += 25;
                mitigations.push('Review user activity logs for anomalies');
              }
            }
          }
          break;
        }

        case 'compliance': {
          const rulesResult = await query(`
            SELECT COUNT(*) as inactive_rules
            FROM domain_rules
            WHERE is_active = false
              AND effective_from <= NOW()
          `);

          const inactiveCount = parseInt((rulesResult.rows[0] as any).inactive_rules);
          
          if (inactiveCount > 10) {
            factors.push({
              name: 'Inactive compliance rules',
              impact: 'high',
              description: `${inactiveCount} rules are currently inactive`
            });
            score += 35;
            mitigations.push('Review and reactivate critical compliance rules');
          }
          break;
        }

        case 'operation': {
          // Check recent alerts
          const alertsResult = await query(`
            SELECT severity, COUNT(*) as count
            FROM alerts
            WHERE is_resolved = false
            GROUP BY severity
          `);

          for (const row of alertsResult.rows as any[]) {
            if (row.severity === 'critical') {
              factors.push({
                name: 'Unresolved critical alerts',
                impact: 'high',
                description: `${row.count} critical alerts pending`
              });
              score += 40;
            } else if (row.severity === 'high') {
              factors.push({
                name: 'Unresolved high alerts',
                impact: 'medium',
                description: `${row.count} high priority alerts pending`
              });
              score += 20;
            }
          }
          mitigations.push('Address all critical and high priority alerts immediately');
          break;
        }
      }

      // Determine risk level
      let level: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (score >= 60) level = 'critical';
      else if (score >= 40) level = 'high';
      else if (score >= 20) level = 'medium';

      return {
        success: true,
        data: {
          risk: {
            level,
            score: Math.min(100, score),
            factors,
            mitigations,
            requiresAction: level === 'critical' || level === 'high'
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'risk_assessment failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Risk assessment failed'
      };
    }
  }
};

// ===========================================
// TOOL: Check Compliance
// ===========================================

const checkComplianceTool: Tool = {
  name: 'check_compliance',
  description: 'Check compliance status against regulations and rules',
  category: 'database',
  inputSchema: z.object({
    regulation: z.string().optional(),
    category: z.string().optional(),
    entityType: z.enum(['transaction', 'user', 'process']).optional(),
    entityId: z.string().optional()
  }),
  outputSchema: z.object({
    compliance: z.object({
      status: z.enum(['compliant', 'non_compliant', 'needs_review']),
      score: z.number(),
      violations: z.array(z.object({
        rule: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        description: z.string()
      })),
      recommendations: z.array(z.string())
    })
  }),
  requiresPermission: ['check_compliance'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { category, regulation } = params as {
        category?: string;
        regulation?: string;
      };

      let whereClause = 'is_active = true';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (category) {
        whereClause += ` AND category = $${paramIndex++}`;
        queryParams.push(category);
      }

      const rulesResult = await query(`
        SELECT * FROM domain_rules WHERE ${whereClause} ORDER BY priority DESC
      `, queryParams);

      const violations: Array<{ rule: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string }> = [];
      const recommendations: string[] = [];
      
      let totalRules = rulesResult.rows.length;
      let passedRules = totalRules; // Assume all pass initially

      // Simplified compliance check - in production, evaluate each rule
      for (const row of rulesResult.rows as any[]) {
        // Check if rule is properly configured
        if (!row.condition_expr || row.condition_expr === 'true') {
          // Rule needs proper condition
          violations.push({
            rule: row.name,
            severity: row.priority > 80 ? 'high' : 'medium',
            description: 'Rule requires specific conditions to be defined'
          });
          passedRules--;
        }
      }

      const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;
      
      let status: 'compliant' | 'non_compliant' | 'needs_review' = 'compliant';
      if (score < 70) status = 'non_compliant';
      else if (score < 90) status = 'needs_review';

      if (violations.length > 0) {
        recommendations.push('Review and update rule conditions for comprehensive compliance');
      }
      if (status === 'needs_review') {
        recommendations.push('Schedule compliance review meeting with stakeholders');
      }

      return {
        success: true,
        data: {
          compliance: {
            status,
            score,
            violations,
            recommendations
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'check_compliance failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compliance check failed'
      };
    }
  }
};

// ===========================================
// EXPORTS
// ===========================================

export const analysisTools: Tool[] = [
  analyzeDataTool,
  analyzeBehaviorTool,
  riskAssessmentTool,
  checkComplianceTool
];






