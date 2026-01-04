// ===========================================
// NEXUS AI PLATFORM - CALCULATION TOOLS
// Tools for financial and statistical calculations
// ===========================================

import { z } from 'zod';
import { Tool, ToolContext, ToolResult, JSONObject } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ===========================================
// TOOL: Calculate Metrics
// ===========================================

const calculateMetricsTool: Tool = {
  name: 'calculate_metrics',
  description: 'Calculate various financial and business metrics',
  category: 'calculation',
  inputSchema: z.object({
    metricType: z.enum([
      'growth_rate',
      'ratio',
      'percentage',
      'moving_average',
      'variance',
      'cagr',
      'roi',
      'margin'
    ]),
    values: z.array(z.number()).min(1),
    params: z.object({
      period: z.number().optional(),
      baseValue: z.number().optional(),
      investmentCost: z.number().optional(),
      revenue: z.number().optional(),
      cost: z.number().optional()
    }).optional()
  }),
  outputSchema: z.object({
    result: z.number(),
    formatted: z.string(),
    metadata: z.object({
      calculationType: z.string(),
      inputCount: z.number(),
      formula: z.string()
    })
  }),
  requiresPermission: [],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { metricType, values, params: calcParams } = params as {
        metricType: string;
        values: number[];
        params?: Record<string, number>;
      };

      let result: number;
      let formula: string;

      switch (metricType) {
        case 'growth_rate':
          if (values.length < 2) throw new Error('Need at least 2 values for growth rate');
          result = ((values[values.length - 1] - values[0]) / values[0]) * 100;
          formula = '((final - initial) / initial) × 100';
          break;

        case 'ratio':
          if (values.length !== 2) throw new Error('Need exactly 2 values for ratio');
          result = values[0] / values[1];
          formula = 'value1 / value2';
          break;

        case 'percentage':
          if (values.length !== 2) throw new Error('Need exactly 2 values for percentage');
          result = (values[0] / values[1]) * 100;
          formula = '(part / whole) × 100';
          break;

        case 'moving_average':
          const period = calcParams?.period || 3;
          if (values.length < period) throw new Error(`Need at least ${period} values`);
          const slice = values.slice(-period);
          result = slice.reduce((a, b) => a + b, 0) / period;
          formula = `sum(last ${period} values) / ${period}`;
          break;

        case 'variance':
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          result = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
          formula = 'Σ(xi - μ)² / n';
          break;

        case 'cagr':
          if (values.length < 2) throw new Error('Need at least 2 values for CAGR');
          const years = calcParams?.period || values.length - 1;
          result = (Math.pow(values[values.length - 1] / values[0], 1 / years) - 1) * 100;
          formula = '((final/initial)^(1/years) - 1) × 100';
          break;

        case 'roi':
          const gain = values[0];
          const cost = calcParams?.investmentCost || values[1];
          result = ((gain - cost) / cost) * 100;
          formula = '((gain - cost) / cost) × 100';
          break;

        case 'margin':
          const revenue = calcParams?.revenue || values[0];
          const expenses = calcParams?.cost || values[1];
          result = ((revenue - expenses) / revenue) * 100;
          formula = '((revenue - cost) / revenue) × 100';
          break;

        default:
          throw new Error(`Unknown metric type: ${metricType}`);
      }

      return {
        success: true,
        data: {
          result: Math.round(result * 10000) / 10000,
          formatted: `${result.toFixed(2)}${metricType.includes('rate') || metricType.includes('percentage') || metricType === 'margin' || metricType === 'roi' || metricType === 'cagr' ? '%' : ''}`,
          metadata: {
            calculationType: metricType,
            inputCount: values.length,
            formula
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'calculate_metrics failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }
};

// ===========================================
// TOOL: Forecast
// ===========================================

const forecastTool: Tool = {
  name: 'forecast',
  description: 'Generate forecasts using statistical methods',
  category: 'calculation',
  inputSchema: z.object({
    historicalData: z.array(z.object({
      value: z.number(),
      timestamp: z.string().optional(),
      label: z.string().optional()
    })).min(3),
    periods: z.number().min(1).max(24).default(3),
    method: z.enum(['linear', 'exponential', 'moving_average']).default('linear'),
    confidenceLevel: z.number().min(0.5).max(0.99).default(0.95)
  }),
  outputSchema: z.object({
    forecasts: z.array(z.object({
      period: z.number(),
      value: z.number(),
      lowerBound: z.number(),
      upperBound: z.number()
    })),
    model: z.object({
      method: z.string(),
      parameters: z.record(z.number()),
      r_squared: z.number().optional()
    }),
    summary: z.object({
      trend: z.enum(['increasing', 'decreasing', 'stable']),
      avgGrowthRate: z.number()
    })
  }),
  requiresPermission: [],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { historicalData, periods, method, confidenceLevel } = params as {
        historicalData: Array<{ value: number }>;
        periods: number;
        method: string;
        confidenceLevel: number;
      };

      const values = historicalData.map(d => d.value);
      const n = values.length;
      const forecasts: Array<{
        period: number;
        value: number;
        lowerBound: number;
        upperBound: number;
      }> = [];

      // Calculate statistics
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // Z-score for confidence interval
      const zScore = method === 'linear' ? 1.96 : 1.645; // Simplified

      let modelParams: Record<string, number> = {};
      let rSquared: number | undefined;

      switch (method) {
        case 'linear': {
          // Simple linear regression
          const xMean = (n - 1) / 2;
          let numerator = 0;
          let denominator = 0;

          for (let i = 0; i < n; i++) {
            numerator += (i - xMean) * (values[i] - mean);
            denominator += Math.pow(i - xMean, 2);
          }

          const slope = denominator !== 0 ? numerator / denominator : 0;
          const intercept = mean - slope * xMean;

          modelParams = { slope, intercept };

          // Calculate R-squared
          let ssRes = 0, ssTot = 0;
          for (let i = 0; i < n; i++) {
            const predicted = intercept + slope * i;
            ssRes += Math.pow(values[i] - predicted, 2);
            ssTot += Math.pow(values[i] - mean, 2);
          }
          rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

          // Generate forecasts
          for (let i = 1; i <= periods; i++) {
            const forecastValue = intercept + slope * (n - 1 + i);
            const margin = zScore * stdDev * Math.sqrt(1 + 1/n + Math.pow(i, 2) / denominator);
            
            forecasts.push({
              period: i,
              value: Math.round(forecastValue * 100) / 100,
              lowerBound: Math.round((forecastValue - margin) * 100) / 100,
              upperBound: Math.round((forecastValue + margin) * 100) / 100
            });
          }
          break;
        }

        case 'exponential': {
          // Simple exponential smoothing
          const alpha = 0.3;
          let smoothed = values[0];
          
          for (let i = 1; i < n; i++) {
            smoothed = alpha * values[i] + (1 - alpha) * smoothed;
          }

          modelParams = { alpha, lastSmoothed: smoothed };

          for (let i = 1; i <= periods; i++) {
            const margin = zScore * stdDev * Math.sqrt(i);
            forecasts.push({
              period: i,
              value: Math.round(smoothed * 100) / 100,
              lowerBound: Math.round((smoothed - margin) * 100) / 100,
              upperBound: Math.round((smoothed + margin) * 100) / 100
            });
          }
          break;
        }

        case 'moving_average': {
          const windowSize = Math.min(3, n);
          const lastValues = values.slice(-windowSize);
          const maValue = lastValues.reduce((a, b) => a + b, 0) / windowSize;

          modelParams = { windowSize, movingAverage: maValue };

          for (let i = 1; i <= periods; i++) {
            const margin = zScore * stdDev / Math.sqrt(windowSize);
            forecasts.push({
              period: i,
              value: Math.round(maValue * 100) / 100,
              lowerBound: Math.round((maValue - margin) * 100) / 100,
              upperBound: Math.round((maValue + margin) * 100) / 100
            });
          }
          break;
        }
      }

      // Determine trend
      const firstThird = values.slice(0, Math.floor(n/3)).reduce((a,b) => a+b, 0) / Math.floor(n/3);
      const lastThird = values.slice(-Math.floor(n/3)).reduce((a,b) => a+b, 0) / Math.floor(n/3);
      const changePercent = ((lastThird - firstThird) / firstThird) * 100;

      const trend = changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable';

      return {
        success: true,
        data: {
          forecasts,
          model: {
            method,
            parameters: modelParams,
            r_squared: rSquared
          },
          summary: {
            trend,
            avgGrowthRate: Math.round(changePercent * 100) / 100
          }
        }
      };
    } catch (error) {
      logger.error({ error }, 'forecast failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Forecast failed'
      };
    }
  }
};

// ===========================================
// TOOL: Trend Analysis
// ===========================================

const trendAnalysisTool: Tool = {
  name: 'trend_analysis',
  description: 'Analyze trends in time-series data',
  category: 'calculation',
  inputSchema: z.object({
    data: z.array(z.object({
      value: z.number(),
      timestamp: z.string().optional(),
      label: z.string().optional()
    })).min(2),
    metric: z.string().optional()
  }),
  outputSchema: z.object({
    trend: z.object({
      direction: z.enum(['up', 'down', 'stable']),
      strength: z.enum(['strong', 'moderate', 'weak']),
      changePercent: z.number()
    }),
    statistics: z.object({
      min: z.number(),
      max: z.number(),
      mean: z.number(),
      median: z.number(),
      stdDev: z.number()
    }),
    anomalies: z.array(z.object({
      index: z.number(),
      value: z.number(),
      deviation: z.number()
    }))
  }),
  requiresPermission: [],
  riskLevel: 'read',
  execute: async (params: JSONObject, context: ToolContext): Promise<ToolResult> => {
    try {
      const { data } = params as {
        data: Array<{ value: number }>;
      };

      const values = data.map(d => d.value);
      const n = values.length;

      // Calculate statistics
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[n - 1];
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const median = n % 2 === 0 
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
        : sorted[Math.floor(n/2)];
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // Trend analysis
      const firstHalf = values.slice(0, Math.floor(n/2));
      const secondHalf = values.slice(Math.floor(n/2));
      const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const changePercent = firstMean !== 0 ? ((secondMean - firstMean) / firstMean) * 100 : 0;
      
      let direction: 'up' | 'down' | 'stable';
      if (changePercent > 5) direction = 'up';
      else if (changePercent < -5) direction = 'down';
      else direction = 'stable';

      let strength: 'strong' | 'moderate' | 'weak';
      const absChange = Math.abs(changePercent);
      if (absChange > 20) strength = 'strong';
      else if (absChange > 10) strength = 'moderate';
      else strength = 'weak';

      // Anomaly detection (values beyond 2 standard deviations)
      const anomalies = values
        .map((value, index) => ({
          index,
          value,
          deviation: (value - mean) / stdDev
        }))
        .filter(a => Math.abs(a.deviation) > 2);

      return {
        success: true,
        data: {
          trend: {
            direction,
            strength,
            changePercent: Math.round(changePercent * 100) / 100
          },
          statistics: {
            min: Math.round(min * 100) / 100,
            max: Math.round(max * 100) / 100,
            mean: Math.round(mean * 100) / 100,
            median: Math.round(median * 100) / 100,
            stdDev: Math.round(stdDev * 100) / 100
          },
          anomalies
        }
      };
    } catch (error) {
      logger.error({ error }, 'trend_analysis failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }
};

// ===========================================
// EXPORTS
// ===========================================

export const calculationTools: Tool[] = [
  calculateMetricsTool,
  forecastTool,
  trendAnalysisTool
];






