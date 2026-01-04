// ===========================================
// NEXUS AI PLATFORM - PROACTIVE INTELLIGENCE
// AI-driven anomaly detection and opportunity finder
// ===========================================

import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { query, db } from '../database/connection.js';
import { createEmbedding, completeWithSchema } from '../ai/llm-provider.js';
import {
  ProactiveInsight,
  InsightType,
  DataPoint,
  SuggestedAction,
  UUID
} from '../types/index.js';

// ===========================================
// PROACTIVE INTELLIGENCE SERVICE
// ===========================================

export class ProactiveIntelligenceService {
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;

  // ===========================================
  // LIFECYCLE
  // ===========================================

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Proactive Intelligence Service started');

    // Run initial scan
    this.runFullScan();

    // Schedule periodic scans
    this.scanInterval = setInterval(
      () => this.runFullScan(),
      config.proactiveScanIntervalMs
    );
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    logger.info('Proactive Intelligence Service stopped');
  }

  // ===========================================
  // MAIN SCAN PROCESS
  // ===========================================

  async runFullScan(): Promise<void> {
    logger.info('Starting proactive intelligence scan');
    const startTime = Date.now();

    try {
      // Run all detectors in parallel
      const [anomalies, opportunities, trends, risks] = await Promise.all([
        this.detectAnomalies(),
        this.findOpportunities(),
        this.analyzeTrends(),
        this.assessRisks()
      ]);

      // Store insights
      const allInsights = [...anomalies, ...opportunities, ...trends, ...risks];
      
      for (const insight of allInsights) {
        await this.storeInsight(insight);
      }

      const duration = Date.now() - startTime;
      logger.info({ 
        duration, 
        insightsGenerated: allInsights.length,
        anomalies: anomalies.length,
        opportunities: opportunities.length,
        trends: trends.length,
        risks: risks.length
      }, 'Proactive intelligence scan completed');

    } catch (error) {
      logger.error({ error }, 'Proactive intelligence scan failed');
    }
  }

  // ===========================================
  // ANOMALY DETECTION
  // ===========================================

  async detectAnomalies(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    try {
      // Financial anomalies
      const financialAnomalies = await this.detectFinancialAnomalies();
      insights.push(...financialAnomalies);

      // System anomalies
      const systemAnomalies = await this.detectSystemAnomalies();
      insights.push(...systemAnomalies);

      // User behavior anomalies
      const behaviorAnomalies = await this.detectBehaviorAnomalies();
      insights.push(...behaviorAnomalies);

    } catch (error) {
      logger.error({ error }, 'Anomaly detection failed');
    }

    return insights;
  }

  private async detectFinancialAnomalies(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    // Get recent transaction statistics
    const statsResult = await query(`
      SELECT 
        AVG(amount) as avg_amount,
        STDDEV(amount) as std_dev,
        MAX(amount) as max_amount
      FROM financial_transactions
      WHERE transaction_date > NOW() - INTERVAL '30 days'
    `);

    const stats = statsResult.rows[0] as any;
    if (!stats) return insights;

    const avgAmount = parseFloat(stats.avg_amount || '0');
    const stdDev = parseFloat(stats.std_dev || '0');
    const threshold = avgAmount + (config.anomalyThreshold * stdDev);

    // Find transactions exceeding threshold
    const anomaliesResult = await query(`
      SELECT id, amount, type, category, transaction_date
      FROM financial_transactions
      WHERE transaction_date > NOW() - INTERVAL '24 hours'
        AND amount > $1
      ORDER BY amount DESC
      LIMIT 10
    `, [threshold]);

    for (const row of anomaliesResult.rows as any[]) {
      const deviations = (parseFloat(row.amount) - avgAmount) / stdDev;
      
      insights.push({
        id: uuidv4(),
        type: 'anomaly',
        title: `Unusual transaction detected: ${row.type}`,
        description: `Transaction of $${row.amount} is ${deviations.toFixed(1)} standard deviations above average`,
        severity: deviations > 4 ? 'critical' : deviations > 3 ? 'warning' : 'info',
        confidence: Math.min(0.95, 0.7 + (deviations / 10)),
        dataPoints: [{
          metric: 'transaction_amount',
          value: parseFloat(row.amount),
          timestamp: row.transaction_date,
          context: `Category: ${row.category}`
        }],
        suggestedActions: [{
          id: uuidv4(),
          description: 'Review transaction details and verify legitimacy',
          impact: 'high',
          effort: 'low',
          requiresApproval: deviations > 4,
          automatable: false
        }],
        createdAt: new Date()
      });
    }

    return insights;
  }

  private async detectSystemAnomalies(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    // Check for unusual alert patterns
    const alertsResult = await query(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM alerts
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND is_resolved = false
      GROUP BY severity
    `);

    const criticalCount = (alertsResult.rows as any[])
      .find(r => r.severity === 'critical')?.count || 0;

    if (parseInt(criticalCount) > 5) {
      insights.push({
        id: uuidv4(),
        type: 'anomaly',
        title: 'Spike in critical alerts',
        description: `${criticalCount} critical alerts in the past hour - potential system issue`,
        severity: 'critical',
        confidence: 0.9,
        dataPoints: [{
          metric: 'critical_alerts',
          value: parseInt(criticalCount),
          timestamp: new Date()
        }],
        suggestedActions: [{
          id: uuidv4(),
          description: 'Investigate root cause of alert spike',
          impact: 'high',
          effort: 'medium',
          requiresApproval: false,
          automatable: false
        }],
        createdAt: new Date()
      });
    }

    return insights;
  }

  private async detectBehaviorAnomalies(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    // Check for unusual user activity
    const activityResult = await query(`
      SELECT 
        user_id,
        COUNT(*) as action_count
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 100
    `);

    for (const row of activityResult.rows as any[]) {
      insights.push({
        id: uuidv4(),
        type: 'anomaly',
        title: 'Unusual user activity detected',
        description: `User performed ${row.action_count} actions in the past hour`,
        severity: parseInt(row.action_count) > 500 ? 'critical' : 'warning',
        confidence: 0.8,
        dataPoints: [{
          metric: 'user_actions',
          value: parseInt(row.action_count),
          timestamp: new Date(),
          context: `User ID: ${row.user_id}`
        }],
        suggestedActions: [{
          id: uuidv4(),
          description: 'Review user activity logs for potential automation or abuse',
          impact: 'medium',
          effort: 'low',
          requiresApproval: false,
          automatable: false
        }],
        createdAt: new Date()
      });
    }

    return insights;
  }

  // ===========================================
  // OPPORTUNITY DETECTION
  // ===========================================

  async findOpportunities(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    try {
      // Cost optimization opportunities
      const costResult = await query(`
        SELECT 
          category,
          SUM(amount) as total,
          COUNT(*) as transaction_count
        FROM financial_transactions
        WHERE type = 'expense'
          AND transaction_date > NOW() - INTERVAL '30 days'
        GROUP BY category
        ORDER BY total DESC
        LIMIT 5
      `);

      const topCategories = costResult.rows as any[];
      
      if (topCategories.length > 1) {
        const topCategory = topCategories[0];
        const totalSpend = topCategories.reduce((sum, c) => sum + parseFloat(c.total), 0);
        const topPercentage = (parseFloat(topCategory.total) / totalSpend) * 100;

        if (topPercentage > 40) {
          insights.push({
            id: uuidv4(),
            type: 'opportunity',
            title: `Cost concentration in ${topCategory.category}`,
            description: `${topPercentage.toFixed(1)}% of expenses are in ${topCategory.category}. Consider diversification or negotiation.`,
            severity: 'info',
            confidence: 0.85,
            dataPoints: [{
              metric: 'category_spend',
              value: parseFloat(topCategory.total),
              timestamp: new Date(),
              context: `${topCategory.transaction_count} transactions`
            }],
            suggestedActions: [
              {
                id: uuidv4(),
                description: 'Review vendor contracts for negotiation opportunities',
                impact: 'high',
                effort: 'medium',
                requiresApproval: false,
                automatable: false
              },
              {
                id: uuidv4(),
                description: 'Analyze alternative suppliers or solutions',
                impact: 'medium',
                effort: 'high',
                requiresApproval: false,
                automatable: false
              }
            ],
            createdAt: new Date()
          });
        }
      }

      // User engagement opportunities
      const engagementResult = await query(`
        SELECT 
          COUNT(DISTINCT user_id) as inactive_users
        FROM users
        WHERE last_login_at < NOW() - INTERVAL '30 days'
          AND is_active = true
      `);

      const inactiveCount = parseInt((engagementResult.rows[0] as any).inactive_users || '0');
      
      if (inactiveCount > 10) {
        insights.push({
          id: uuidv4(),
          type: 'opportunity',
          title: 'User re-engagement opportunity',
          description: `${inactiveCount} active users haven't logged in for 30+ days`,
          severity: 'info',
          confidence: 0.9,
          dataPoints: [{
            metric: 'inactive_users',
            value: inactiveCount,
            timestamp: new Date()
          }],
          suggestedActions: [{
            id: uuidv4(),
            description: 'Launch re-engagement email campaign',
            impact: 'high',
            effort: 'low',
            requiresApproval: true,
            automatable: true
          }],
          createdAt: new Date()
        });
      }

    } catch (error) {
      logger.error({ error }, 'Opportunity detection failed');
    }

    return insights;
  }

  // ===========================================
  // TREND ANALYSIS
  // ===========================================

  async analyzeTrends(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    try {
      // Revenue trend analysis
      const trendResult = await query(`
        SELECT 
          DATE_TRUNC('week', transaction_date) as week,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM financial_transactions
        WHERE transaction_date > NOW() - INTERVAL '8 weeks'
        GROUP BY week
        ORDER BY week
      `);

      const weeks = trendResult.rows as any[];
      
      if (weeks.length >= 4) {
        const recentWeeks = weeks.slice(-4);
        const olderWeeks = weeks.slice(0, -4);

        const recentAvgRevenue = recentWeeks.reduce((sum, w) => sum + parseFloat(w.revenue || '0'), 0) / recentWeeks.length;
        const olderAvgRevenue = olderWeeks.length > 0 
          ? olderWeeks.reduce((sum, w) => sum + parseFloat(w.revenue || '0'), 0) / olderWeeks.length
          : recentAvgRevenue;

        const growthRate = olderAvgRevenue > 0 
          ? ((recentAvgRevenue - olderAvgRevenue) / olderAvgRevenue) * 100 
          : 0;

        if (Math.abs(growthRate) > 10) {
          insights.push({
            id: uuidv4(),
            type: 'trend',
            title: `Revenue ${growthRate > 0 ? 'growth' : 'decline'} detected`,
            description: `Weekly revenue has ${growthRate > 0 ? 'increased' : 'decreased'} by ${Math.abs(growthRate).toFixed(1)}% over the past month`,
            severity: growthRate < -20 ? 'warning' : 'info',
            confidence: 0.85,
            dataPoints: weeks.map(w => ({
              metric: 'weekly_revenue',
              value: parseFloat(w.revenue || '0'),
              timestamp: w.week
            })),
            suggestedActions: [{
              id: uuidv4(),
              description: growthRate > 0 
                ? 'Identify factors driving growth for replication'
                : 'Investigate causes of decline and develop mitigation plan',
              impact: 'high',
              effort: 'medium',
              requiresApproval: false,
              automatable: false
            }],
            createdAt: new Date()
          });
        }
      }

    } catch (error) {
      logger.error({ error }, 'Trend analysis failed');
    }

    return insights;
  }

  // ===========================================
  // RISK ASSESSMENT
  // ===========================================

  async assessRisks(): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    try {
      // Compliance risk
      const complianceResult = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_active = false) as inactive_rules,
          COUNT(*) as total_rules
        FROM domain_rules
        WHERE effective_from <= NOW()
      `);

      const compliance = complianceResult.rows[0] as any;
      const inactivePercentage = compliance.total_rules > 0
        ? (parseInt(compliance.inactive_rules) / parseInt(compliance.total_rules)) * 100
        : 0;

      if (inactivePercentage > 20) {
        insights.push({
          id: uuidv4(),
          type: 'risk',
          title: 'Compliance coverage gap',
          description: `${inactivePercentage.toFixed(1)}% of compliance rules are inactive`,
          severity: inactivePercentage > 40 ? 'critical' : 'warning',
          confidence: 0.95,
          dataPoints: [{
            metric: 'inactive_rules_percentage',
            value: inactivePercentage,
            timestamp: new Date()
          }],
          suggestedActions: [{
            id: uuidv4(),
            description: 'Review and reactivate critical compliance rules',
            impact: 'high',
            effort: 'medium',
            requiresApproval: true,
            automatable: false
          }],
          createdAt: new Date()
        });
      }

      // Operational risk - unresolved alerts
      const alertRiskResult = await query(`
        SELECT COUNT(*) as unresolved
        FROM alerts
        WHERE is_resolved = false
          AND severity IN ('critical', 'high')
          AND created_at < NOW() - INTERVAL '24 hours'
      `);

      const unresolvedCount = parseInt((alertRiskResult.rows[0] as any).unresolved || '0');
      
      if (unresolvedCount > 5) {
        insights.push({
          id: uuidv4(),
          type: 'risk',
          title: 'Stale critical alerts',
          description: `${unresolvedCount} high-priority alerts unresolved for 24+ hours`,
          severity: 'critical',
          confidence: 0.95,
          dataPoints: [{
            metric: 'stale_alerts',
            value: unresolvedCount,
            timestamp: new Date()
          }],
          suggestedActions: [{
            id: uuidv4(),
            description: 'Escalate to on-call team for immediate resolution',
            impact: 'high',
            effort: 'low',
            requiresApproval: false,
            automatable: true
          }],
          createdAt: new Date()
        });
      }

    } catch (error) {
      logger.error({ error }, 'Risk assessment failed');
    }

    return insights;
  }

  // ===========================================
  // INSIGHT STORAGE
  // ===========================================

  private async storeInsight(insight: ProactiveInsight): Promise<void> {
    await db.insert('proactive_insights', {
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      confidence: insight.confidence,
      data_points: JSON.stringify(insight.dataPoints),
      suggested_actions: JSON.stringify(insight.suggestedActions),
      is_acknowledged: false,
      expires_at: insight.expiresAt || null,
      created_at: insight.createdAt
    });
  }

  // ===========================================
  // PUBLIC API
  // ===========================================

  async getRecentInsights(limit = 20): Promise<ProactiveInsight[]> {
    const result = await query(`
      SELECT * FROM proactive_insights
      WHERE (expires_at IS NULL OR expires_at > NOW())
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'warning' THEN 2 
          ELSE 3 
        END,
        created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map((r: any) => ({
      id: r.id,
      type: r.type as InsightType,
      title: r.title,
      description: r.description,
      severity: r.severity,
      confidence: parseFloat(r.confidence),
      dataPoints: JSON.parse(r.data_points),
      suggestedActions: JSON.parse(r.suggested_actions),
      expiresAt: r.expires_at,
      createdAt: r.created_at
    }));
  }

  async acknowledgeInsight(insightId: UUID, userId: UUID): Promise<void> {
    await db.update('proactive_insights', { id: insightId }, {
      is_acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date()
    });
  }

  async getInsightsByType(type: InsightType, limit = 10): Promise<ProactiveInsight[]> {
    const result = await query(`
      SELECT * FROM proactive_insights
      WHERE type = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT $2
    `, [type, limit]);

    return result.rows.map((r: any) => ({
      id: r.id,
      type: r.type as InsightType,
      title: r.title,
      description: r.description,
      severity: r.severity,
      confidence: parseFloat(r.confidence),
      dataPoints: JSON.parse(r.data_points),
      suggestedActions: JSON.parse(r.suggested_actions),
      expiresAt: r.expires_at,
      createdAt: r.created_at
    }));
  }
}

// ===========================================
// SINGLETON
// ===========================================

let instance: ProactiveIntelligenceService | null = null;

export function getProactiveIntelligence(): ProactiveIntelligenceService {
  if (!instance) {
    instance = new ProactiveIntelligenceService();
  }
  return instance;
}






