// ===========================================
// NEXUS AI PLATFORM - DATABASE TOOLS
// Tools for querying and managing data
// ===========================================

import { z } from 'zod';
import { query, db } from '../database/connection.js';
import { Tool, ToolContext, ToolResult, JSONObject } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ===========================================
// TOOL: Query Financial Data
// ===========================================

const queryFinancialDataTool: Tool = {
  name: 'query_financial_data',
  description: 'Query financial transactions and related data with filters',
  category: 'database',
  inputSchema: z.object({
    entity: z.enum(['transactions', 'summary', 'categories']).default('transactions'),
    filters: z.object({
      userId: z.string().uuid().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      type: z.string().optional(),
      category: z.string().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional()
    }).optional(),
    aggregation: z.enum(['none', 'sum', 'avg', 'count', 'daily', 'monthly']).default('none'),
    limit: z.number().min(1).max(1000).default(100),
    orderBy: z.string().optional()
  }),
  outputSchema: z.object({
    data: z.array(z.record(z.unknown())),
    total: z.number(),
    aggregations: z.record(z.number()).optional()
  }),
  requiresPermission: ['read_financial_data'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { entity, filters, aggregation, limit, orderBy } = params as {
        entity: string;
        filters?: Record<string, unknown>;
        aggregation: string;
        limit: number;
        orderBy?: string;
      };

      let sql = '';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      switch (entity) {
        case 'transactions':
          sql = `SELECT * FROM financial_transactions WHERE 1=1`;
          break;
        case 'summary':
          sql = `
            SELECT 
              type,
              COUNT(*) as transaction_count,
              SUM(amount) as total_amount,
              AVG(amount) as avg_amount
            FROM financial_transactions
            WHERE 1=1
          `;
          break;
        case 'categories':
          sql = `
            SELECT DISTINCT category, COUNT(*) as count
            FROM financial_transactions
            WHERE category IS NOT NULL
          `;
          break;
      }

      // Apply filters
      if (filters) {
        if (filters.userId) {
          sql += ` AND user_id = $${paramIndex++}`;
          queryParams.push(filters.userId);
        }
        if (filters.dateFrom) {
          sql += ` AND transaction_date >= $${paramIndex++}`;
          queryParams.push(filters.dateFrom);
        }
        if (filters.dateTo) {
          sql += ` AND transaction_date <= $${paramIndex++}`;
          queryParams.push(filters.dateTo);
        }
        if (filters.type) {
          sql += ` AND type = $${paramIndex++}`;
          queryParams.push(filters.type);
        }
        if (filters.category) {
          sql += ` AND category = $${paramIndex++}`;
          queryParams.push(filters.category);
        }
        if (filters.minAmount !== undefined) {
          sql += ` AND amount >= $${paramIndex++}`;
          queryParams.push(filters.minAmount);
        }
        if (filters.maxAmount !== undefined) {
          sql += ` AND amount <= $${paramIndex++}`;
          queryParams.push(filters.maxAmount);
        }
      }

      // Group by for summary
      if (entity === 'summary') {
        sql += ' GROUP BY type';
      } else if (entity === 'categories') {
        sql += ' GROUP BY category';
      }

      // Order and limit
      if (orderBy) {
        sql += ` ORDER BY ${orderBy}`;
      } else if (entity === 'transactions') {
        sql += ' ORDER BY transaction_date DESC';
      }
      sql += ` LIMIT ${limit}`;

      const result = await query(sql, queryParams);

      return {
        success: true,
        data: {
          data: result.rows,
          total: result.rowCount || 0
        }
      };
    } catch (error) {
      logger.error({ error }, 'query_financial_data failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }
};

// ===========================================
// TOOL: Query User Data
// ===========================================

const queryUserDataTool: Tool = {
  name: 'query_user_data',
  description: 'Query user profiles and activity data',
  category: 'database',
  inputSchema: z.object({
    dataType: z.enum(['profile', 'activity', 'preferences', 'sessions']),
    userId: z.string().uuid().optional(),
    filters: z.record(z.unknown()).optional(),
    limit: z.number().min(1).max(100).default(50)
  }),
  outputSchema: z.object({
    data: z.array(z.record(z.unknown())),
    total: z.number()
  }),
  requiresPermission: ['read_user_data'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { dataType, userId, limit } = params as {
        dataType: string;
        userId?: string;
        limit: number;
      };

      let tableName = '';
      let selectFields = '*';

      switch (dataType) {
        case 'profile':
          tableName = 'users';
          selectFields = 'id, email, name, role, preferences, created_at';
          break;
        case 'activity':
          tableName = 'audit_logs';
          break;
        case 'preferences':
          tableName = 'users';
          selectFields = 'id, preferences';
          break;
        case 'sessions':
          tableName = 'sessions';
          break;
      }

      const whereClause = userId ? { user_id: userId } : {};
      const rows = await db.findMany(tableName, whereClause, {
        columns: selectFields,
        limit,
        orderBy: 'created_at DESC'
      });

      return {
        success: true,
        data: {
          data: rows,
          total: rows.length
        }
      };
    } catch (error) {
      logger.error({ error }, 'query_user_data failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }
};

// ===========================================
// TOOL: Query Metrics
// ===========================================

const queryMetricsTool: Tool = {
  name: 'query_metrics',
  description: 'Query system and business metrics',
  category: 'database',
  inputSchema: z.object({
    metricName: z.string().optional(),
    dimensions: z.record(z.string()).optional(),
    timeRange: z.object({
      from: z.string(),
      to: z.string()
    }).optional(),
    aggregation: z.enum(['none', 'sum', 'avg', 'min', 'max', 'count']).default('none'),
    groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
    limit: z.number().min(1).max(10000).default(1000)
  }),
  outputSchema: z.object({
    metrics: z.array(z.object({
      name: z.string(),
      value: z.number(),
      timestamp: z.string().optional(),
      dimensions: z.record(z.string()).optional()
    })),
    summary: z.object({
      min: z.number(),
      max: z.number(),
      avg: z.number(),
      count: z.number()
    }).optional()
  }),
  requiresPermission: ['read_metrics'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { metricName, timeRange, aggregation, groupBy, limit } = params as {
        metricName?: string;
        timeRange?: { from: string; to: string };
        aggregation: string;
        groupBy?: string;
        limit: number;
      };

      let sql = 'SELECT name, value, recorded_at, dimensions FROM metrics WHERE 1=1';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (metricName) {
        sql += ` AND name = $${paramIndex++}`;
        queryParams.push(metricName);
      }

      if (timeRange) {
        sql += ` AND recorded_at >= $${paramIndex++} AND recorded_at <= $${paramIndex++}`;
        queryParams.push(timeRange.from, timeRange.to);
      }

      sql += ` ORDER BY recorded_at DESC LIMIT ${limit}`;

      const result = await query(sql, queryParams);

      // Calculate summary statistics
      const values = result.rows.map((r: any) => r.value as number);
      const summary = values.length > 0 ? {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length
      } : undefined;

      return {
        success: true,
        data: {
          metrics: result.rows.map((r: any) => ({
            name: r.name,
            value: r.value,
            timestamp: r.recorded_at,
            dimensions: r.dimensions
          })),
          summary
        }
      };
    } catch (error) {
      logger.error({ error }, 'query_metrics failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }
};

// ===========================================
// TOOL: Query Rules
// ===========================================

const queryRulesTool: Tool = {
  name: 'query_rules',
  description: 'Query domain rules and compliance requirements',
  category: 'database',
  inputSchema: z.object({
    category: z.string().optional(),
    activeOnly: z.boolean().default(true),
    search: z.string().optional(),
    limit: z.number().min(1).max(100).default(50)
  }),
  outputSchema: z.object({
    rules: z.array(z.object({
      id: z.string(),
      category: z.string(),
      name: z.string(),
      description: z.string(),
      condition: z.string(),
      action: z.string(),
      priority: z.number(),
      isActive: z.boolean()
    })),
    total: z.number()
  }),
  requiresPermission: ['read_rules'],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { category, activeOnly, search, limit } = params as {
        category?: string;
        activeOnly: boolean;
        search?: string;
        limit: number;
      };

      let sql = 'SELECT * FROM domain_rules WHERE 1=1';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (activeOnly) {
        sql += ' AND is_active = true';
      }

      if (category) {
        sql += ` AND category = $${paramIndex++}`;
        queryParams.push(category);
      }

      if (search) {
        sql += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      sql += ` ORDER BY priority DESC LIMIT ${limit}`;

      const result = await query(sql, queryParams);

      return {
        success: true,
        data: {
          rules: result.rows.map((r: any) => ({
            id: r.id,
            category: r.category,
            name: r.name,
            description: r.description,
            condition: r.condition_expr,
            action: r.action_expr,
            priority: r.priority,
            isActive: r.is_active
          })),
          total: result.rowCount || 0
        }
      };
    } catch (error) {
      logger.error({ error }, 'query_rules failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }
};

// ===========================================
// EXPORTS
// ===========================================

export const databaseTools: Tool[] = [
  queryFinancialDataTool,
  queryUserDataTool,
  queryMetricsTool,
  queryRulesTool
];






