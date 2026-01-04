// ===========================================
// NEXUS AI PLATFORM - STRATEGY AGENT
// Specialized in strategic analysis and recommendations
// ===========================================

import { BaseAgent } from './base-agent.js';
import { JSONValue, JSONObject } from '../types/index.js';

export class StrategyAgent extends BaseAgent {
  protected getSpecializedSystemPrompt(): string {
    return `
STRATEGY & RECOMMENDATION SPECIALIZATION:

You are an expert strategist and business advisor with knowledge in:
- Strategic planning and analysis
- Market analysis and competitive intelligence
- Decision science and frameworks
- Risk-benefit analysis
- Growth strategy
- Resource optimization

STRATEGIC FRAMEWORKS YOU USE:
- SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats)
- Porter's Five Forces
- BCG Matrix
- OKR (Objectives and Key Results)
- Decision trees and scenario planning
- Cost-benefit analysis

ANALYSIS APPROACH:
1. Understand the business context and objectives
2. Gather and synthesize relevant data
3. Identify key drivers and constraints
4. Generate multiple strategic options
5. Evaluate options against criteria
6. Recommend with clear rationale

RECOMMENDATION STRUCTURE:
- Primary recommendation with clear action items
- Alternative options considered
- Key assumptions and dependencies
- Risk factors and mitigation
- Expected outcomes and metrics
- Implementation timeline

DECISION SUPPORT PRINCIPLES:
- Present balanced perspectives
- Quantify when possible
- Acknowledge uncertainty
- Consider short and long-term implications
- Align with organizational goals
- Be actionable and specific`;
  }

  protected getSpecializedCapabilities(): string[] {
    return [
      'Strategic analysis',
      'Opportunity identification',
      'Risk assessment',
      'Scenario planning',
      'Competitive analysis',
      'Action planning'
    ];
  }

  protected parseOutput(content: string): JSONValue {
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(content);
    } catch {
      return {
        type: 'strategic_analysis',
        summary: content,
        recommendations: this.extractRecommendations(content),
        risks: this.extractRisks(content),
        opportunities: this.extractOpportunities(content),
        rawContent: content,
        generatedAt: new Date().toISOString()
      };
    }
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || 
          line.toLowerCase().includes('suggest') ||
          line.toLowerCase().includes('propose')) {
        inRecommendations = true;
        if (line.trim().length > 20) {
          recommendations.push(line.trim());
        }
      }
      if (inRecommendations && (line.trim().startsWith('-') || line.trim().startsWith('•'))) {
        recommendations.push(line.replace(/^[-•]\s*/, '').trim());
      }
      if (inRecommendations && line.trim() === '') {
        inRecommendations = false;
      }
    }

    return [...new Set(recommendations)].slice(0, 5);
  }

  private extractRisks(content: string): string[] {
    const risks: string[] = [];
    const riskPatterns = [
      /risk[s]?:?\s*([^\n]+)/gi,
      /threat[s]?:?\s*([^\n]+)/gi,
      /concern[s]?:?\s*([^\n]+)/gi
    ];

    for (const pattern of riskPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          risks.push(match[1].trim());
        }
      }
    }

    return [...new Set(risks)].slice(0, 5);
  }

  private extractOpportunities(content: string): string[] {
    const opportunities: string[] = [];
    const oppPatterns = [
      /opportunit(?:y|ies):?\s*([^\n]+)/gi,
      /potential[s]?:?\s*([^\n]+)/gi,
      /could\s+(?:increase|improve|enhance)\s*([^\n]+)/gi
    ];

    for (const pattern of oppPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          opportunities.push(match[1].trim());
        }
      }
    }

    return [...new Set(opportunities)].slice(0, 5);
  }

  protected getToolPurpose(toolName: string, args: JSONObject): string {
    const purposes: Record<string, (args: JSONObject) => string> = {
      analyze_data: (a) => `analyze ${a.dataType || 'business'} data for strategic insights`,
      generate_recommendations: (a) => `generate recommendations for ${a.objective || 'business improvement'}`,
      evaluate_options: (a) => `evaluate strategic options for ${a.decision || 'business decision'}`,
      create_plan: (a) => `create action plan for ${a.initiative || 'strategic initiative'}`,
      assess_impact: (a) => `assess impact of ${a.action || 'proposed action'}`
    };

    return purposes[toolName]?.(args) || `perform ${toolName} strategic analysis`;
  }
}






