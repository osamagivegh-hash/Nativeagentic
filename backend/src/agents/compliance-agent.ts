// ===========================================
// NEXUS AI PLATFORM - COMPLIANCE AGENT
// Specialized in regulatory compliance and rule validation
// ===========================================

import { BaseAgent } from './base-agent.js';
import { JSONValue, JSONObject } from '../types/index.js';

export class ComplianceAgent extends BaseAgent {
  protected getSpecializedSystemPrompt(): string {
    return `
COMPLIANCE & RULES SPECIALIZATION:

You are an expert compliance officer with deep knowledge in:
- Regulatory frameworks (SOX, GDPR, HIPAA, PCI-DSS, etc.)
- Internal policy enforcement
- Risk assessment and mitigation
- Audit preparation
- Data governance
- Anti-money laundering (AML) procedures

COMPLIANCE PRINCIPLES:
1. NEVER approve uncertain compliance matters - flag for human review
2. Always cite specific regulations or policies
3. Maintain strict audit trails
4. Escalate potential violations immediately
5. Consider both letter and spirit of regulations

RISK CATEGORIES YOU ASSESS:
- Regulatory risk (fines, sanctions)
- Reputational risk
- Operational risk
- Legal risk
- Financial risk

VALIDATION PROCESS:
1. Identify applicable regulations/rules
2. Check current status against requirements
3. Identify gaps or violations
4. Assess severity and impact
5. Recommend remediation steps
6. Document findings thoroughly

CRITICAL REQUIREMENTS:
- Be conservative in compliance assessments
- Document all decisions with reasoning
- Never make assumptions about regulatory interpretation
- Always recommend expert review for complex matters
- Track regulatory deadlines and changes`;
  }

  protected getSpecializedCapabilities(): string[] {
    return [
      'Regulatory requirement mapping',
      'Compliance gap analysis',
      'Policy violation detection',
      'Risk scoring',
      'Audit trail generation',
      'Remediation planning'
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
        type: 'compliance_assessment',
        summary: content,
        riskLevel: this.extractRiskLevel(content),
        requiresReview: content.toLowerCase().includes('review') || 
                        content.toLowerCase().includes('escalate'),
        rawContent: content,
        generatedAt: new Date().toISOString()
      };
    }
  }

  private extractRiskLevel(content: string): string {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('critical') || lowercaseContent.includes('violation')) {
      return 'critical';
    }
    if (lowercaseContent.includes('high risk') || lowercaseContent.includes('non-compliant')) {
      return 'high';
    }
    if (lowercaseContent.includes('medium risk') || lowercaseContent.includes('attention')) {
      return 'medium';
    }
    return 'low';
  }

  protected getToolPurpose(toolName: string, args: JSONObject): string {
    const purposes: Record<string, (args: JSONObject) => string> = {
      check_compliance: (a) => `check compliance with ${a.regulation || 'applicable regulations'}`,
      query_rules: (a) => `retrieve rules for ${a.category || 'compliance check'}`,
      validate_transaction: (a) => `validate transaction ${a.transactionId || ''} for compliance`,
      generate_compliance_report: (a) => `generate compliance report for ${a.period || 'current period'}`,
      risk_assessment: (a) => `assess risk for ${a.entity || 'operation'}`
    };

    return purposes[toolName]?.(args) || `perform ${toolName} compliance check`;
  }
}






