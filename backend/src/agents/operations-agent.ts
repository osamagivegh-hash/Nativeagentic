// ===========================================
// NEXUS AI PLATFORM - OPERATIONS AGENT
// Specialized in system health and operational tasks
// ===========================================

import { BaseAgent } from './base-agent.js';
import { JSONValue, JSONObject } from '../types/index.js';

export class OperationsAgent extends BaseAgent {
  protected getSpecializedSystemPrompt(): string {
    return `
OPERATIONS & SYSTEM HEALTH SPECIALIZATION:

You are an expert in system operations and infrastructure with knowledge in:
- System monitoring and observability
- Performance optimization
- Incident management
- Capacity planning
- Infrastructure automation
- Service reliability engineering (SRE)

KEY METRICS YOU MONITOR:
- System availability (uptime)
- Response latency (p50, p95, p99)
- Error rates
- Resource utilization (CPU, memory, disk, network)
- Throughput and request rates
- Queue depths and processing times
- Database performance

OPERATIONAL APPROACH:
1. Proactively identify issues before they impact users
2. Correlate events across systems
3. Prioritize based on business impact
4. Automate routine operations
5. Document runbooks and procedures
6. Learn from incidents

ALERT SEVERITY LEVELS:
- CRITICAL: Immediate action required, user impact
- HIGH: Quick action needed, potential user impact
- MEDIUM: Investigation needed, no immediate impact
- LOW: Informational, monitor for changes

SAFETY REQUIREMENTS:
- NEVER execute destructive operations without explicit approval
- Always verify changes before applying
- Maintain rollback capabilities
- Log all system modifications
- Follow change management procedures`;
  }

  protected getSpecializedCapabilities(): string[] {
    return [
      'System health monitoring',
      'Performance analysis',
      'Alert management',
      'Log analysis',
      'Capacity planning',
      'Incident correlation'
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
        type: 'operations_report',
        summary: content,
        systemStatus: this.extractSystemStatus(content),
        alerts: this.extractAlerts(content),
        rawContent: content,
        generatedAt: new Date().toISOString()
      };
    }
  }

  private extractSystemStatus(content: string): string {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('critical') || lowercaseContent.includes('down')) {
      return 'critical';
    }
    if (lowercaseContent.includes('degraded') || lowercaseContent.includes('warning')) {
      return 'degraded';
    }
    if (lowercaseContent.includes('healthy') || lowercaseContent.includes('normal')) {
      return 'healthy';
    }
    return 'unknown';
  }

  private extractAlerts(content: string): Array<{ severity: string; message: string }> {
    const alerts: Array<{ severity: string; message: string }> = [];
    const alertPatterns = [
      /(?:CRITICAL|HIGH|MEDIUM|LOW):\s*([^\n]+)/gi,
      /alert[s]?:?\s*([^\n]+)/gi
    ];

    for (const pattern of alertPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[0] && match[1]) {
          const severityMatch = match[0].match(/CRITICAL|HIGH|MEDIUM|LOW/i);
          alerts.push({
            severity: severityMatch ? severityMatch[0].toLowerCase() : 'medium',
            message: match[1].trim()
          });
        }
      }
    }

    return alerts;
  }

  protected getToolPurpose(toolName: string, args: JSONObject): string {
    const purposes: Record<string, (args: JSONObject) => string> = {
      query_metrics: (a) => `query ${a.metric || 'system'} metrics`,
      check_system_health: (a) => `check health of ${a.system || 'all systems'}`,
      analyze_logs: (a) => `analyze logs for ${a.service || 'system'} in ${a.timeRange || 'recent period'}`,
      manage_alerts: (a) => `${a.action || 'manage'} alerts for ${a.service || 'system'}`,
      execute_operation: (a) => `execute ${a.operation || 'maintenance'} operation`
    };

    return purposes[toolName]?.(args) || `perform ${toolName} operation`;
  }
}






