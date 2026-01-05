// ===========================================
// NEXUS AI PLATFORM - AI ORCHESTRATOR
// The Core Brain: Intent → Plan → Execute → Validate → Explain
// ===========================================

import { v4 as uuidv4 } from 'uuid';
import { orchestratorConfig } from '../config/index.js';
import { logger, createTaskLogger, logAIDecision } from '../utils/logger.js';
import { complete, completeWithSchema, LLMMessage } from '../ai/llm-provider.js';
import { AgentRegistry } from '../agents/registry.js';
import { MemoryManager } from '../memory/manager.js';
import { AuditService } from '../services/audit.js';
import {
  Intent,
  TaskPlan,
  TaskStep,
  TaskComplexity,
  ExecutionStatus,
  AgentType,
  AgentResult,
  Explanation,
  User,
  UUID,
  JSONObject,
  Message,
  RiskAssessment
} from '../types/index.js';

// ===========================================
// ORCHESTRATOR STATE
// ===========================================

interface OrchestratorState {
  taskId: UUID;
  userId: UUID;
  sessionId: UUID;
  status: ExecutionStatus;
  intent?: Intent;
  plan?: TaskPlan;
  results: AgentResult[];
  explanation?: Explanation;
  startTime: number;
  retryCount: number;
}

// ===========================================
// MAIN ORCHESTRATOR CLASS
// ===========================================

export class AIOrchestrator {
  private agentRegistry: AgentRegistry;
  private memoryManager: MemoryManager;
  private auditService: AuditService;

  constructor(
    agentRegistry: AgentRegistry,
    memoryManager: MemoryManager,
    auditService: AuditService
  ) {
    this.agentRegistry = agentRegistry;
    this.memoryManager = memoryManager;
    this.auditService = auditService;
  }

  // ===========================================
  // MAIN PROCESSING PIPELINE
  // ===========================================

  async process(
    userMessage: string,
    user: User,
    sessionId: UUID,
    conversationHistory: Message[] = []
  ): Promise<OrchestratorResult> {
    const taskId = uuidv4();
    const taskLogger = createTaskLogger(taskId, user.id);
    
    const state: OrchestratorState = {
      taskId,
      userId: user.id,
      sessionId,
      status: 'pending',
      results: [],
      startTime: Date.now(),
      retryCount: 0
    };

    taskLogger.info({ message: userMessage }, 'Starting task processing');

    try {
      // PHASE 1: Intent Understanding
      state.status = 'planning';
      state.intent = await this.parseIntent(userMessage, conversationHistory, user);
      
      logAIDecision(taskId, {
        type: 'intent_parsing',
        input: userMessage,
        output: state.intent,
        confidence: state.intent.confidence
      });

      // Check if clarification needed
      if (state.intent.requiresClarification) {
        return this.buildClarificationResponse(state);
      }

      // PHASE 2: Task Planning
      state.plan = await this.createPlan(state.intent, user);
      
      logAIDecision(taskId, {
        type: 'task_planning',
        input: state.intent,
        output: state.plan,
        confidence: 1 - (state.plan.riskAssessment.level === 'critical' ? 0.5 : 0)
      });

      // Check if approval required
      if (state.plan.riskAssessment.requiresApproval) {
        state.status = 'awaiting_approval';
        return this.buildApprovalRequest(state);
      }

      // PHASE 3: Execution
      state.status = 'executing';
      state.results = await this.executePlan(state.plan, state, user);

      // PHASE 4: Validation
      state.status = 'validating';
      const validationResult = await this.validateResults(state.results, state.intent);
      
      if (!validationResult.isValid && state.retryCount < orchestratorConfig.maxRetries) {
        state.retryCount++;
        taskLogger.warn({ attempt: state.retryCount }, 'Validation failed, retrying');
        // Re-execute failed steps
        const failedSteps = state.plan.steps.filter(s => 
          state.results.find(r => r.stepId === s.id && r.status === 'failed')
        );
        const retryResults = await this.retrySteps(failedSteps, state, user);
        state.results = [...state.results, ...retryResults];
      }

      // PHASE 5: Explanation Generation
      state.status = 'completed';
      state.explanation = await this.generateExplanation(state);

      // Log to audit
      await this.auditService.logAIDecision({
        taskId,
        userId: user.id,
        sessionId,
        intent: state.intent,
        plan: state.plan,
        results: state.results,
        explanation: state.explanation
      });

      // Store operational learnings
      await this.memoryManager.storeOperationalLearning({
        taskId,
        intent: state.intent,
        plan: state.plan,
        results: state.results,
        success: state.results.every(r => r.status === 'success')
      });

      return this.buildSuccessResponse(state);

    } catch (error) {
      state.status = 'failed';
      taskLogger.error({ error }, 'Task processing failed');
      
      await this.auditService.logError({
        taskId,
        userId: user.id,
        error: error instanceof Error ? error : new Error(String(error))
      });

      return this.buildErrorResponse(state, error);
    }
  }

  // ===========================================
  // PHASE 1: INTENT PARSING
  // ===========================================

  private async parseIntent(
    message: string,
    history: Message[],
    user: User
  ): Promise<Intent> {
    // Retrieve relevant memories for context
    const userMemories = await this.memoryManager.getUserMemories(user.id, message, 5);
    const domainRules = await this.memoryManager.getRelevantDomainRules(message);

    const systemPrompt = `You are an intent parser for an AI-native business platform.
Your job is to understand what the user wants and extract structured information.

User Preferences: ${JSON.stringify(user.preferences)}
Relevant User History: ${userMemories.map(m => m.content).join('\n')}
Applicable Domain Rules: ${domainRules.map(r => `${r.name}: ${r.description}`).join('\n')}

Analyze the user's message and extract:
1. The primary category of the request
2. Any specific entities mentioned (amounts, dates, names, etc.)
3. The confidence level of your understanding
4. Whether clarification is needed

Categories: financial_analysis, compliance_check, user_behavior, system_operations, strategy_recommendation, general_query`;

    const conversationContext = history.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    const result = await completeWithSchema<{
      category: string;
      subcategory: string;
      entities: Array<{ type: string; value: string; confidence: number }>;
      normalizedQuery: string;
      confidence: number;
      requiresClarification: boolean;
      clarificationQuestions: string[];
    }>(
      [
        ...conversationContext,
        { role: 'user', content: message }
      ],
      {
        type: 'object',
        properties: {
          category: { type: 'string' },
          subcategory: { type: 'string' },
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: 'string' },
                confidence: { type: 'number' }
              }
            }
          },
          normalizedQuery: { type: 'string' },
          confidence: { type: 'number' },
          requiresClarification: { type: 'boolean' },
          clarificationQuestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['category', 'normalizedQuery', 'confidence', 'requiresClarification']
      }
    );

    return {
      id: uuidv4(),
      rawInput: message,
      normalizedQuery: result.normalizedQuery,
      category: result.category,
      subcategory: result.subcategory || '',
      entities: result.entities?.map(e => ({
        ...e,
        source: e.confidence > 0.8 ? 'explicit' : 'inferred'
      })) || [],
      confidence: result.confidence,
      requiresClarification: result.requiresClarification,
      clarificationQuestions: result.clarificationQuestions
    };
  }

  // ===========================================
  // PHASE 2: TASK PLANNING
  // ===========================================

  private async createPlan(intent: Intent, user: User): Promise<TaskPlan> {
    const complexity = this.assessComplexity(intent);
    const requiredAgents = this.determineRequiredAgents(intent);
    
    const systemPrompt = `You are a task planner for an AI system.
Given the user's intent, create a detailed execution plan.

Available agents: ${requiredAgents.join(', ')}
Available tools per agent:
${requiredAgents.map(a => `- ${a}: ${this.agentRegistry.getAgentTools(a).join(', ')}`).join('\n')}

User permissions: ${user.permissions.join(', ')}

Create a step-by-step plan that:
1. Breaks down the task into atomic steps
2. Assigns each step to the appropriate agent
3. Specifies which tools each step will use
4. Identifies dependencies between steps
5. Estimates timeout for each step`;

    const planResult = await completeWithSchema<{
      steps: Array<{
        agentType: string;
        action: string;
        toolCalls: Array<{ toolName: string; purpose: string }>;
        dependencies: string[];
        canParallelize: boolean;
        timeout: number;
      }>;
      estimatedDuration: number;
      riskFactors: Array<{ type: string; description: string; severity: number }>;
    }>(
      [
        { role: 'user', content: `Plan execution for: ${intent.normalizedQuery}\n\nEntities: ${JSON.stringify(intent.entities)}` }
      ],
      {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                agentType: { type: 'string' },
                action: { type: 'string' },
                toolCalls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      toolName: { type: 'string' },
                      purpose: { type: 'string' }
                    }
                  }
                },
                dependencies: { type: 'array', items: { type: 'string' } },
                canParallelize: { type: 'boolean' },
                timeout: { type: 'number' }
              }
            }
          },
          estimatedDuration: { type: 'number' },
          riskFactors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                description: { type: 'string' },
                severity: { type: 'number' }
              }
            }
          }
        },
        required: ['steps', 'estimatedDuration']
      }
    );

    const steps: TaskStep[] = planResult.steps.map((s, idx) => ({
      id: uuidv4(),
      order: idx + 1,
      agentType: s.agentType as AgentType,
      action: s.action,
      toolCalls: s.toolCalls.map(tc => ({
        toolName: tc.toolName,
        purpose: tc.purpose,
        estimatedParams: {}
      })),
      dependencies: s.dependencies || [],
      canParallelize: s.canParallelize ?? false,
      timeout: s.timeout || 10000
    }));

    const riskAssessment = this.assessRisk(planResult.riskFactors || [], complexity, user);

    return {
      id: uuidv4(),
      intentId: intent.id,
      complexity,
      steps,
      estimatedDuration: planResult.estimatedDuration,
      requiredAgents,
      requiredTools: [...new Set(steps.flatMap(s => s.toolCalls.map(tc => tc.toolName)))],
      riskAssessment,
      createdAt: new Date()
    };
  }

  private assessComplexity(intent: Intent): TaskComplexity {
    const entityCount = intent.entities.length;
    const hasFinancial = intent.category.includes('financial');
    const hasCompliance = intent.category.includes('compliance');
    
    if (hasCompliance && hasFinancial) return 'critical';
    if (entityCount > 5 || hasCompliance) return 'complex';
    if (entityCount > 2) return 'moderate';
    return 'simple';
  }

  private determineRequiredAgents(intent: Intent): AgentType[] {
    const mapping: Record<string, AgentType[]> = {
      financial_analysis: ['financial', 'strategy'],
      compliance_check: ['compliance', 'operations'],
      user_behavior: ['user_insight', 'strategy'],
      system_operations: ['operations'],
      strategy_recommendation: ['strategy', 'financial', 'user_insight'],
      general_query: ['operations']
    };

    return mapping[intent.category] || ['operations'];
  }

  private assessRisk(
    factors: Array<{ type: string; description: string; severity: number }>,
    complexity: TaskComplexity,
    user: User
  ): RiskAssessment {
    const maxSeverity = Math.max(...factors.map(f => f.severity), 0);
    
    let level: RiskAssessment['level'] = 'low';
    if (maxSeverity > 8 || complexity === 'critical') level = 'critical';
    else if (maxSeverity > 5 || complexity === 'complex') level = 'high';
    else if (maxSeverity > 3) level = 'medium';

    const requiresApproval = level === 'critical' || 
      (level === 'high' && !user.permissions.includes('high_risk_operations'));

    return {
      level,
      factors: factors.map(f => ({
        type: f.type,
        description: f.description,
        severity: f.severity
      })),
      mitigations: factors.map(f => `Monitor ${f.type} throughout execution`),
      requiresApproval
    };
  }

  // ===========================================
  // PHASE 3: EXECUTION
  // ===========================================

  private async executePlan(
    plan: TaskPlan,
    state: OrchestratorState,
    user: User
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const completedStepIds = new Set<string>();

    // Group steps by parallelization possibility
    const stepGroups = this.groupStepsByDependencies(plan.steps);

    for (const group of stepGroups) {
      // Execute parallelizable steps concurrently
      const parallelSteps = group.filter(s => s.canParallelize);
      const sequentialSteps = group.filter(s => !s.canParallelize);

      // Execute parallel steps
      if (parallelSteps.length > 0) {
        const parallelResults = await Promise.all(
          parallelSteps.map(step => this.executeStep(step, state, user, results))
        );
        results.push(...parallelResults);
        parallelSteps.forEach(s => completedStepIds.add(s.id));
      }

      // Execute sequential steps
      for (const step of sequentialSteps) {
        const result = await this.executeStep(step, state, user, results);
        results.push(result);
        completedStepIds.add(step.id);
      }
    }

    return results;
  }

  private groupStepsByDependencies(steps: TaskStep[]): TaskStep[][] {
    const groups: TaskStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    while (remaining.length > 0) {
      const executable = remaining.filter(step =>
        step.dependencies.every(dep => completed.has(dep))
      );

      if (executable.length === 0 && remaining.length > 0) {
        // Circular dependency or invalid plan - execute remaining sequentially
        groups.push(remaining);
        break;
      }

      groups.push(executable);
      executable.forEach(s => completed.add(s.id));
      remaining.splice(0, remaining.length, ...remaining.filter(s => !completed.has(s.id)));
    }

    return groups;
  }

  private async executeStep(
    step: TaskStep,
    state: OrchestratorState,
    user: User,
    previousResults: AgentResult[]
  ): Promise<AgentResult> {
    const agent = this.agentRegistry.getAgent(step.agentType);
    
    const context = {
      conversationHistory: [],
      relevantMemories: await this.memoryManager.getUserMemories(user.id, step.action, 3),
      domainKnowledge: await this.memoryManager.getRelevantDomainRules(step.action),
      previousResults
    };

    const result = await agent.execute({
      taskId: state.taskId,
      stepId: step.id,
      instruction: step.action,
      context,
      constraints: {
        maxToolCalls: 10,
        timeout: step.timeout,
        allowedTools: step.toolCalls.map(tc => tc.toolName),
        forbiddenActions: [],
        requireExplanation: true
      }
    });

    return result;
  }

  private async retrySteps(
    steps: TaskStep[],
    state: OrchestratorState,
    user: User
  ): Promise<AgentResult[]> {
    return Promise.all(
      steps.map(step => this.executeStep(step, state, user, state.results))
    );
  }

  // ===========================================
  // PHASE 4: VALIDATION
  // ===========================================

  private async validateResults(
    results: AgentResult[],
    intent: Intent
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const failedResults = results.filter(r => r.status === 'failed');
    const lowConfidenceResults = results.filter(r => 
      r.confidence < orchestratorConfig.confidenceThreshold
    );

    const issues: string[] = [];
    
    if (failedResults.length > 0) {
      issues.push(`${failedResults.length} steps failed to execute`);
    }

    if (lowConfidenceResults.length > 0) {
      issues.push(`${lowConfidenceResults.length} steps have low confidence scores`);
    }

    // AI-based validation
    const validationResult = await completeWithSchema<{
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    }>(
      [{
        role: 'user',
        content: `Validate if these results satisfy the intent.
Intent: ${intent.normalizedQuery}
Results: ${JSON.stringify(results.map(r => ({ output: r.output, confidence: r.confidence })))}`
      }],
      {
        type: 'object',
        properties: {
          isValid: { type: 'boolean' },
          issues: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['isValid']
      }
    );

    return {
      isValid: issues.length === 0 && validationResult.isValid,
      issues: [...issues, ...(validationResult.issues || [])]
    };
  }

  // ===========================================
  // PHASE 5: EXPLANATION GENERATION
  // ===========================================

  private async generateExplanation(state: OrchestratorState): Promise<Explanation> {
    const explanationResult = await completeWithSchema<{
      summary: string;
      reasoning: string;
      dataSources: string[];
      confidence: number;
      limitations: string[];
      alternativeApproaches: string[];
    }>(
      [{
        role: 'user',
        content: `Generate an explanation for this AI decision.
Intent: ${state.intent?.normalizedQuery}
Plan: ${JSON.stringify(state.plan?.steps.map(s => s.action))}
Results: ${JSON.stringify(state.results.map(r => ({
  agent: r.agentType,
  output: r.output,
  confidence: r.confidence,
  reasoning: r.reasoning.conclusion
})))}`
      }],
      {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          reasoning: { type: 'string' },
          dataSources: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          limitations: { type: 'array', items: { type: 'string' } },
          alternativeApproaches: { type: 'array', items: { type: 'string' } }
        },
        required: ['summary', 'reasoning', 'confidence']
      }
    );

    return explanationResult;
  }

  // ===========================================
  // RESPONSE BUILDERS
  // ===========================================

  private buildSuccessResponse(state: OrchestratorState): OrchestratorResult {
    const duration = Date.now() - state.startTime;
    const totalTokens = state.results.reduce((sum, r) => sum + r.tokensUsed, 0);

    return {
      taskId: state.taskId,
      status: 'completed',
      response: this.formatResponse(state),
      explanation: state.explanation!,
      metadata: {
        duration,
        totalTokens,
        agentsUsed: [...new Set(state.results.map(r => r.agentType))],
        toolsUsed: [...new Set(state.results.flatMap(r => r.toolsUsed.map(t => t.toolName)))],
        confidenceScores: state.results.map(r => r.confidence)
      }
    };
  }

  private buildClarificationResponse(state: OrchestratorState): OrchestratorResult {
    return {
      taskId: state.taskId,
      status: 'awaiting_input',
      response: `I need some clarification to help you better:\n\n${state.intent!.clarificationQuestions?.join('\n')}`,
      explanation: {
        summary: 'Requesting clarification',
        reasoning: 'The intent was not clear enough to proceed',
        dataSources: [],
        confidence: state.intent!.confidence,
        limitations: ['Ambiguous user input'],
        alternativeApproaches: []
      },
      metadata: {
        duration: Date.now() - state.startTime,
        totalTokens: 0,
        agentsUsed: [],
        toolsUsed: [],
        confidenceScores: [state.intent!.confidence]
      }
    };
  }

  private buildApprovalRequest(state: OrchestratorState): OrchestratorResult {
    return {
      taskId: state.taskId,
      status: 'awaiting_approval',
      response: `This action requires approval due to: ${state.plan!.riskAssessment.factors.map(f => f.description).join(', ')}`,
      plan: state.plan,
      explanation: {
        summary: 'Awaiting approval for high-risk operation',
        reasoning: `Risk level: ${state.plan!.riskAssessment.level}`,
        dataSources: [],
        confidence: 0.9,
        limitations: [],
        alternativeApproaches: state.plan!.riskAssessment.mitigations
      },
      metadata: {
        duration: Date.now() - state.startTime,
        totalTokens: 0,
        agentsUsed: state.plan!.requiredAgents,
        toolsUsed: state.plan!.requiredTools,
        confidenceScores: []
      }
    };
  }

  private buildErrorResponse(state: OrchestratorState, error: unknown): OrchestratorResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      taskId: state.taskId,
      status: 'failed',
      response: `I encountered an error while processing your request: ${errorMessage}`,
      error: errorMessage,
      explanation: {
        summary: 'Task failed due to error',
        reasoning: errorMessage,
        dataSources: [],
        confidence: 0,
        limitations: ['Execution error occurred'],
        alternativeApproaches: ['Please try again or rephrase your request']
      },
      metadata: {
        duration: Date.now() - state.startTime,
        totalTokens: state.results.reduce((sum, r) => sum + r.tokensUsed, 0),
        agentsUsed: state.results.map(r => r.agentType),
        toolsUsed: state.results.flatMap(r => r.toolsUsed.map(t => t.toolName)),
        confidenceScores: state.results.map(r => r.confidence)
      }
    };
  }

  private formatResponse(state: OrchestratorState): string {
    // Combine all agent outputs into a coherent response
    const outputs = state.results
      .filter(r => r.status === 'success')
      .map(r => r.output);

    if (outputs.length === 0) {
      return 'I was unable to complete your request. Please try again.';
    }

    // For single output, return as is
    if (outputs.length === 1) {
      return typeof outputs[0] === 'string' ? outputs[0] : JSON.stringify(outputs[0], null, 2);
    }

    // For multiple outputs, combine intelligently
    return outputs.map((o, i) => 
      `**${state.results[i].agentType.toUpperCase()} Analysis:**\n${typeof o === 'string' ? o : JSON.stringify(o, null, 2)}`
    ).join('\n\n');
  }
}

// ===========================================
// ORCHESTRATOR RESULT TYPE
// ===========================================

export interface OrchestratorResult {
  taskId: UUID;
  status: 'completed' | 'awaiting_input' | 'awaiting_approval' | 'failed';
  response: string;
  explanation: Explanation;
  plan?: TaskPlan;
  error?: string;
  metadata: {
    duration: number;
    totalTokens: number;
    agentsUsed: AgentType[];
    toolsUsed: string[];
    confidenceScores: number[];
  };
}






