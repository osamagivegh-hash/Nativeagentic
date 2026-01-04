// ===========================================
// NEXUS AI PLATFORM - USER INSIGHT AGENT
// Specialized in user behavior analysis and personalization
// ===========================================

import { BaseAgent } from './base-agent.js';
import { JSONValue, JSONObject } from '../types/index.js';

export class UserInsightAgent extends BaseAgent {
  protected getSpecializedSystemPrompt(): string {
    return `
USER BEHAVIOR & INSIGHT SPECIALIZATION:

You are an expert in user behavior analysis and customer intelligence with knowledge in:
- Behavioral psychology and patterns
- Customer journey mapping
- Segmentation and cohort analysis
- Engagement metrics analysis
- Churn prediction and prevention
- Personalization strategies

KEY METRICS YOU TRACK:
- User engagement (DAU, MAU, session duration)
- Feature adoption rates
- Retention and churn rates
- Customer satisfaction (NPS, CSAT)
- Conversion funnels
- User lifetime value
- Behavioral cohort performance

ANALYSIS APPROACH:
1. Segment users based on behavior patterns
2. Identify leading indicators of outcomes
3. Look for behavioral anomalies
4. Track user journeys and friction points
5. Generate personalized recommendations
6. Predict future user actions

PRIVACY CONSIDERATIONS:
- Always respect user privacy preferences
- Aggregate data when possible
- Avoid individual tracking without consent
- Focus on patterns, not personal details
- Flag any potential privacy concerns

OUTPUT EXPECTATIONS:
- Provide actionable user insights
- Include statistical significance when relevant
- Segment findings by user cohorts
- Recommend specific interventions
- Quantify expected impact`;
  }

  protected getSpecializedCapabilities(): string[] {
    return [
      'Behavioral pattern recognition',
      'User segmentation',
      'Churn prediction',
      'Engagement analysis',
      'Personalized recommendations',
      'Journey optimization'
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
        type: 'user_insight',
        summary: content,
        segments: this.extractSegments(content),
        recommendations: this.extractRecommendations(content),
        rawContent: content,
        generatedAt: new Date().toISOString()
      };
    }
  }

  private extractSegments(content: string): string[] {
    const segments: string[] = [];
    const segmentPatterns = [
      /segment[s]?:?\s*([^\n]+)/gi,
      /cohort[s]?:?\s*([^\n]+)/gi,
      /group[s]?:?\s*([^\n]+)/gi
    ];

    for (const pattern of segmentPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) segments.push(match[1].trim());
      }
    }

    return [...new Set(segments)];
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || 
          line.toLowerCase().includes('suggest')) {
        inRecommendations = true;
      }
      if (inRecommendations && line.trim().startsWith('-')) {
        recommendations.push(line.replace('-', '').trim());
      }
      if (inRecommendations && line.trim() === '') {
        inRecommendations = false;
      }
    }

    return recommendations;
  }

  protected getToolPurpose(toolName: string, args: JSONObject): string {
    const purposes: Record<string, (args: JSONObject) => string> = {
      query_user_data: (a) => `retrieve user data for ${a.segment || 'analysis'}`,
      analyze_behavior: (a) => `analyze ${a.behaviorType || 'user'} behavior patterns`,
      segment_users: (a) => `segment users based on ${a.criteria || 'behavior'}`,
      predict_churn: (a) => `predict churn risk for ${a.cohort || 'users'}`,
      recommendation_engine: (a) => `generate recommendations for ${a.userId || 'users'}`
    };

    return purposes[toolName]?.(args) || `analyze ${toolName} for user insights`;
  }
}






