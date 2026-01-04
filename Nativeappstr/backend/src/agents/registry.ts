// ===========================================
// NEXUS AI PLATFORM - AGENT REGISTRY
// Central registry for all specialized agents
// ===========================================

import { AgentType, AgentConfig } from '../types/index.js';
import { BaseAgent } from './base-agent.js';
import { ToolRegistry } from '../tools/registry.js';
import { FinancialAgent } from './financial-agent.js';
import { ComplianceAgent } from './compliance-agent.js';
import { UserInsightAgent } from './user-insight-agent.js';
import { OperationsAgent } from './operations-agent.js';
import { StrategyAgent } from './strategy-agent.js';
import { logger } from '../utils/logger.js';

// ===========================================
// AGENT CONFIGURATIONS
// ===========================================

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  financial: {
    type: 'financial',
    name: 'Financial Analysis Agent',
    description: 'Specializes in financial data analysis, forecasting, budgeting, and monetary insights',
    capabilities: [
      'Analyze financial transactions and trends',
      'Generate financial reports and summaries',
      'Perform budget analysis and forecasting',
      'Detect financial anomalies',
      'Calculate financial metrics and KPIs',
      'Provide investment insights'
    ],
    tools: [
      'query_financial_data',
      'calculate_metrics',
      'generate_report',
      'trend_analysis',
      'forecast'
    ],
    systemPrompt: '',
    maxToolCalls: 10,
    timeout: 30000,
    confidenceThreshold: 0.75
  },

  compliance: {
    type: 'compliance',
    name: 'Compliance & Rules Agent',
    description: 'Ensures adherence to regulations, policies, and business rules',
    capabilities: [
      'Check regulatory compliance',
      'Validate against business rules',
      'Identify compliance violations',
      'Generate compliance reports',
      'Assess regulatory risk',
      'Track policy changes'
    ],
    tools: [
      'check_compliance',
      'query_rules',
      'validate_transaction',
      'generate_compliance_report',
      'risk_assessment'
    ],
    systemPrompt: '',
    maxToolCalls: 8,
    timeout: 25000,
    confidenceThreshold: 0.85 // Higher threshold for compliance
  },

  user_insight: {
    type: 'user_insight',
    name: 'User Behavior & Insight Agent',
    description: 'Analyzes user behavior patterns, preferences, and provides personalized insights',
    capabilities: [
      'Analyze user behavior patterns',
      'Track user preferences',
      'Generate personalized recommendations',
      'Segment users',
      'Predict user actions',
      'Measure engagement'
    ],
    tools: [
      'query_user_data',
      'analyze_behavior',
      'segment_users',
      'predict_churn',
      'recommendation_engine'
    ],
    systemPrompt: '',
    maxToolCalls: 8,
    timeout: 20000,
    confidenceThreshold: 0.7
  },

  operations: {
    type: 'operations',
    name: 'Operations & System Health Agent',
    description: 'Monitors system health, manages operations, and handles system-level tasks',
    capabilities: [
      'Monitor system health',
      'Track operational metrics',
      'Manage alerts',
      'Analyze logs',
      'Optimize performance',
      'Handle system tasks'
    ],
    tools: [
      'query_metrics',
      'check_system_health',
      'analyze_logs',
      'manage_alerts',
      'execute_operation'
    ],
    systemPrompt: '',
    maxToolCalls: 15,
    timeout: 20000,
    confidenceThreshold: 0.7
  },

  strategy: {
    type: 'strategy',
    name: 'Strategy & Recommendation Agent',
    description: 'Provides strategic insights, recommendations, and decision support',
    capabilities: [
      'Generate strategic recommendations',
      'Analyze market trends',
      'Provide decision support',
      'Evaluate opportunities',
      'Assess risks and benefits',
      'Create action plans'
    ],
    tools: [
      'analyze_data',
      'generate_recommendations',
      'evaluate_options',
      'create_plan',
      'assess_impact'
    ],
    systemPrompt: '',
    maxToolCalls: 12,
    timeout: 35000,
    confidenceThreshold: 0.7
  }
};

// ===========================================
// AGENT REGISTRY CLASS
// ===========================================

export class AgentRegistry {
  private agents: Map<AgentType, BaseAgent> = new Map();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Initialize all agents
    this.agents.set('financial', new FinancialAgent(
      AGENT_CONFIGS.financial,
      this.toolRegistry
    ));

    this.agents.set('compliance', new ComplianceAgent(
      AGENT_CONFIGS.compliance,
      this.toolRegistry
    ));

    this.agents.set('user_insight', new UserInsightAgent(
      AGENT_CONFIGS.user_insight,
      this.toolRegistry
    ));

    this.agents.set('operations', new OperationsAgent(
      AGENT_CONFIGS.operations,
      this.toolRegistry
    ));

    this.agents.set('strategy', new StrategyAgent(
      AGENT_CONFIGS.strategy,
      this.toolRegistry
    ));

    logger.info({ agents: Array.from(this.agents.keys()) }, 'Agent registry initialized');
  }

  getAgent(type: AgentType): BaseAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`Agent not found: ${type}`);
    }
    return agent;
  }

  getAgentConfig(type: AgentType): AgentConfig {
    return AGENT_CONFIGS[type];
  }

  getAgentTools(type: AgentType): string[] {
    return AGENT_CONFIGS[type]?.tools || [];
  }

  getAllAgentTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  getAgentsByCapability(capability: string): AgentType[] {
    return Object.entries(AGENT_CONFIGS)
      .filter(([_, config]) => 
        config.capabilities.some(c => 
          c.toLowerCase().includes(capability.toLowerCase())
        )
      )
      .map(([type]) => type as AgentType);
  }
}






