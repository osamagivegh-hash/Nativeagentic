// ===========================================
// NEXUS AI PLATFORM - FINANCIAL ANALYSIS AGENT
// Specialized in financial data analysis and insights
// ===========================================

import { BaseAgent } from './base-agent.js';
import { JSONValue, JSONObject } from '../types/index.js';

export class FinancialAgent extends BaseAgent {
  protected getSpecializedSystemPrompt(): string {
    return `
FINANCIAL ANALYSIS SPECIALIZATION:

You are an expert financial analyst with deep knowledge in:
- Financial statement analysis (P&L, Balance Sheet, Cash Flow)
- Ratio analysis (liquidity, profitability, leverage)
- Trend analysis and forecasting
- Budget variance analysis
- Cash flow management
- Investment analysis

KEY METRICS YOU TRACK:
- Revenue growth rate
- Gross margin and net margin
- EBITDA
- Operating cash flow
- Working capital
- Debt-to-equity ratio
- ROI and ROE
- Customer acquisition cost (CAC)
- Lifetime value (LTV)

ANALYSIS APPROACH:
1. Always verify data accuracy before analysis
2. Compare against historical trends
3. Benchmark against industry standards when possible
4. Highlight both opportunities and risks
5. Provide actionable recommendations
6. Quantify impact in monetary terms

OUTPUT EXPECTATIONS:
- Provide specific numbers, not vague statements
- Include confidence intervals for forecasts
- Explain methodology used
- Highlight assumptions made
- Flag any data quality issues`;
  }

  protected getSpecializedCapabilities(): string[] {
    return [
      'Financial ratio calculation',
      'Trend identification',
      'Anomaly detection in transactions',
      'Budget variance analysis',
      'Cash flow forecasting',
      'Revenue projection'
    ];
  }

  protected parseOutput(content: string): JSONValue {
    // Try to extract structured data from the response
    try {
      // Look for JSON blocks in the response
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try to parse the whole content as JSON
      return JSON.parse(content);
    } catch {
      // Return as structured analysis object
      return {
        type: 'financial_analysis',
        summary: content,
        rawContent: content,
        generatedAt: new Date().toISOString()
      };
    }
  }

  protected getToolPurpose(toolName: string, args: JSONObject): string {
    const purposes: Record<string, (args: JSONObject) => string> = {
      query_financial_data: (a) => `retrieve financial data for ${a.entity || 'analysis'}`,
      calculate_metrics: (a) => `calculate ${a.metric || 'financial'} metrics`,
      generate_report: (a) => `generate ${a.reportType || 'financial'} report`,
      trend_analysis: (a) => `analyze trends in ${a.metric || 'financial data'}`,
      forecast: (a) => `forecast ${a.target || 'financial metrics'} for ${a.period || 'next period'}`
    };

    return purposes[toolName]?.(args) || `perform ${toolName} operation`;
  }
}






