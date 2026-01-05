// ===========================================
// NEXUS AI PLATFORM - REPORT TOOLS
// Tools for generating reports and documents
// ===========================================

import { z } from 'zod';
import { Tool, ToolContext, ToolResult, JSONObject } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { query } from '../database/connection.js';

// ===========================================
// TOOL: Generate Report
// ===========================================

const generateReportTool: Tool = {
  name: 'generate_report',
  description: 'Generate formatted reports from data',
  category: 'report',
  inputSchema: z.object({
    reportType: z.enum([
      'financial_summary',
      'compliance_status',
      'user_activity',
      'system_health',
      'custom'
    ]),
    title: z.string().optional(),
    dateRange: z.object({
      from: z.string(),
      to: z.string()
    }).optional(),
    sections: z.array(z.string()).optional(),
    format: z.enum(['json', 'markdown', 'html']).default('json'),
    includeCharts: z.boolean().default(false)
  }),
  outputSchema: z.object({
    report: z.object({
      title: z.string(),
      generatedAt: z.string(),
      dateRange: z.object({
        from: z.string(),
        to: z.string()
      }).optional(),
      sections: z.array(z.object({
        title: z.string(),
        content: z.unknown(),
        charts: z.array(z.unknown()).optional()
      })),
      summary: z.string()
    }),
    metadata: z.object({
      format: z.string(),
      dataPoints: z.number(),
      generationTime: z.number()
    })
  }),
  requiresPermission: ['generate_reports'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { reportType, title, dateRange, format } = params as {
        reportType: string;
        title?: string;
        dateRange?: { from: string; to: string };
        format: string;
      };

      let reportData: {
        title: string;
        sections: Array<{ title: string; content: unknown }>;
        summary: string;
      };

      switch (reportType) {
        case 'financial_summary':
          reportData = await generateFinancialReport(dateRange);
          break;
        case 'compliance_status':
          reportData = await generateComplianceReport(dateRange);
          break;
        case 'user_activity':
          reportData = await generateUserActivityReport(dateRange);
          break;
        case 'system_health':
          reportData = await generateSystemHealthReport(dateRange);
          break;
        default:
          reportData = {
            title: title || 'Custom Report',
            sections: [],
            summary: 'Custom report generated'
          };
      }

      const dataPoints = reportData.sections.reduce((sum, section) => {
        const content = section.content;
        if (Array.isArray(content)) return sum + content.length;
        if (typeof content === 'object' && content !== null) return sum + Object.keys(content).length;
        return sum + 1;
      }, 0);

      return {
        success: true,
        data: {
          report: {
            title: reportData.title,
            generatedAt: new Date().toISOString(),
            dateRange,
            sections: reportData.sections,
            summary: reportData.summary
          },
          metadata: {
            format,
            dataPoints,
            generationTime: Date.now() - startTime
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'generate_report failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  }
};

// Helper functions for report generation
async function generateFinancialReport(dateRange?: { from: string; to: string }) {
  const whereClause = dateRange
    ? `WHERE transaction_date >= '${dateRange.from}' AND transaction_date <= '${dateRange.to}'`
    : '';

  const summaryResult = await query(`
    SELECT 
      type,
      COUNT(*) as count,
      SUM(amount) as total,
      AVG(amount) as average
    FROM financial_transactions
    ${whereClause}
    GROUP BY type
  `);

  const topCategoriesResult = await query(`
    SELECT 
      category,
      SUM(amount) as total
    FROM financial_transactions
    ${whereClause}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 10
  `);

  return {
    title: 'Financial Summary Report',
    sections: [
      {
        title: 'Transaction Summary by Type',
        content: summaryResult.rows
      },
      {
        title: 'Top Categories by Spending',
        content: topCategoriesResult.rows
      }
    ],
    summary: `Analyzed ${summaryResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0)} transactions`
  };
}

async function generateComplianceReport(dateRange?: { from: string; to: string }) {
  const rulesResult = await query(`
    SELECT 
      category,
      COUNT(*) as total_rules,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_rules
    FROM domain_rules
    GROUP BY category
  `);

  return {
    title: 'Compliance Status Report',
    sections: [
      {
        title: 'Rules by Category',
        content: rulesResult.rows
      },
      {
        title: 'Compliance Overview',
        content: {
          totalRules: rulesResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.total_rules), 0),
          activeRules: rulesResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.active_rules), 0),
          categories: rulesResult.rows.length
        }
      }
    ],
    summary: 'Compliance rules assessed and categorized'
  };
}

async function generateUserActivityReport(dateRange?: { from: string; to: string }) {
  const whereClause = dateRange
    ? `WHERE created_at >= '${dateRange.from}' AND created_at <= '${dateRange.to}'`
    : '';

  const activityResult = await query(`
    SELECT 
      action,
      COUNT(*) as count
    FROM audit_logs
    ${whereClause}
    GROUP BY action
    ORDER BY count DESC
    LIMIT 20
  `);

  const userResult = await query(`
    SELECT COUNT(DISTINCT user_id) as active_users
    FROM audit_logs
    ${whereClause}
  `);

  return {
    title: 'User Activity Report',
    sections: [
      {
        title: 'Top Actions',
        content: activityResult.rows
      },
      {
        title: 'User Statistics',
        content: {
          activeUsers: parseInt((userResult.rows[0] as any)?.active_users || '0'),
          totalActions: activityResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0)
        }
      }
    ],
    summary: `Tracked ${(userResult.rows[0] as any)?.active_users || 0} active users`
  };
}

async function generateSystemHealthReport(dateRange?: { from: string; to: string }) {
  const alertsResult = await query(`
    SELECT 
      severity,
      COUNT(*) as count,
      SUM(CASE WHEN is_resolved THEN 1 ELSE 0 END) as resolved
    FROM alerts
    GROUP BY severity
  `);

  return {
    title: 'System Health Report',
    sections: [
      {
        title: 'Alerts by Severity',
        content: alertsResult.rows
      },
      {
        title: 'Health Summary',
        content: {
          totalAlerts: alertsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
          resolvedAlerts: alertsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.resolved), 0),
          severityBreakdown: alertsResult.rows.reduce((acc: any, r: any) => {
            acc[r.severity] = parseInt(r.count);
            return acc;
          }, {})
        }
      }
    ],
    summary: 'System health metrics compiled'
  };
}

// ===========================================
// TOOL: Generate Compliance Report
// ===========================================

const generateComplianceReportTool: Tool = {
  name: 'generate_compliance_report',
  description: 'Generate detailed compliance assessment report',
  category: 'report',
  inputSchema: z.object({
    scope: z.enum(['full', 'category', 'regulation']).default('full'),
    category: z.string().optional(),
    regulation: z.string().optional(),
    includeRecommendations: z.boolean().default(true)
  }),
  outputSchema: z.object({
    compliance: z.object({
      overallScore: z.number(),
      status: z.enum(['compliant', 'partial', 'non_compliant']),
      categories: z.array(z.object({
        name: z.string(),
        score: z.number(),
        issues: z.array(z.string()),
        recommendations: z.array(z.string())
      }))
    }),
    generatedAt: z.string()
  }),
  requiresPermission: ['read_compliance'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const rulesResult = await query(`
        SELECT category, is_active, priority
        FROM domain_rules
        WHERE effective_from <= NOW()
          AND (effective_to IS NULL OR effective_to > NOW())
      `);

      const categories = new Map<string, { active: number; total: number; priority: number }>();

      for (const row of rulesResult.rows as any[]) {
        const cat = categories.get(row.category) || { active: 0, total: 0, priority: 0 };
        cat.total++;
        if (row.is_active) cat.active++;
        cat.priority = Math.max(cat.priority, row.priority);
        categories.set(row.category, cat);
      }

      const categoryScores = Array.from(categories.entries()).map(([name, data]) => {
        const score = data.total > 0 ? (data.active / data.total) * 100 : 0;
        return {
          name,
          score: Math.round(score),
          issues: score < 100 ? [`${data.total - data.active} rules inactive`] : [],
          recommendations: score < 100 ? ['Review and activate pending rules'] : []
        };
      });

      const overallScore = categoryScores.length > 0
        ? Math.round(categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length)
        : 100;

      const status = overallScore >= 90 ? 'compliant'
        : overallScore >= 70 ? 'partial'
          : 'non_compliant';

      return {
        success: true,
        data: {
          compliance: {
            overallScore,
            status,
            categories: categoryScores
          },
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error({ error }, 'generate_compliance_report failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compliance report generation failed'
      };
    }
  }
};

// ===========================================
// EXPORTS
// ===========================================

export const reportTools: Tool[] = [
  generateReportTool,
  generateComplianceReportTool
];






