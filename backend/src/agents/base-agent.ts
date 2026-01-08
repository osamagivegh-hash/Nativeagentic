// ===========================================
// NEXUS AI PLATFORM - BASE AGENT
// Foundation for all specialized agents
// ===========================================

import { v4 as uuidv4 } from 'uuid';
import zodToJsonSchema from 'zod-to-json-schema';
import { complete, LLMMessage, LLMTool, parseToolArguments } from '../ai/llm-provider.js';
import { ToolRegistry } from '../tools/registry.js';
import { createAgentLogger } from '../utils/logger.js';
import {
  AgentConfig,
  AgentInput,
  AgentResult,
  AgentType,
  ReasoningChain,
  ReasoningStep,
  ToolExecution,
  JSONValue,
  JSONObject
} from '../types/index.js';

// ===========================================
// BASE AGENT CLASS
// ===========================================

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected toolRegistry: ToolRegistry;

  constructor(config: AgentConfig, toolRegistry: ToolRegistry) {
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  get type(): AgentType {
    return this.config.type;
  }

  get tools(): string[] {
    return this.config.tools;
  }

  // ===========================================
  // MAIN EXECUTION METHOD
  // ===========================================

  async execute(input: AgentInput): Promise<AgentResult> {
    const logger = createAgentLogger(this.config.type, input.taskId);
    const startTime = Date.now();
    const toolExecutions: ToolExecution[] = [];
    const reasoningSteps: ReasoningStep[] = [];

    logger.info({ instruction: input.instruction }, 'Agent execution started');

    try {
      // Build initial messages
      const messages: LLMMessage[] = [
        { role: 'system', content: this.buildSystemPrompt(input) },
        { role: 'user', content: this.buildUserPrompt(input) }
      ];

      // Get available tools
      const tools = this.buildToolDefinitions(input.constraints.allowedTools);

      let iterations = 0;
      const maxIterations = input.constraints.maxToolCalls;
      let finalOutput: JSONValue = null;

      // ReAct loop: Reason → Act → Observe
      while (iterations < maxIterations) {
        iterations++;

        const response = await complete({
          messages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice: tools.length > 0 ? 'auto' : undefined,
          temperature: 0.3, // Lower temperature for more reliable tool calling
          maxTokens: 2048
        });

        // If no tool calls, we have our final answer
        if (response.toolCalls.length === 0) {
          finalOutput = this.parseOutput(response.content || '');

          reasoningSteps.push({
            thought: 'Reached final conclusion',
            action: 'generate_response',
            observation: response.content || '',
            confidence: this.calculateConfidence(reasoningSteps, toolExecutions)
          });

          break;
        }

        // Process tool calls
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = parseToolArguments(toolCall.function.arguments);

          logger.debug({ toolName, toolArgs }, 'Executing tool');

          // Record the thought
          reasoningSteps.push({
            thought: `Need to use ${toolName} to ${this.getToolPurpose(toolName, toolArgs)}`,
            action: `call_tool: ${toolName}`,
            observation: 'Awaiting result...',
            confidence: 0.8
          });

          // Execute the tool
          const toolExecution = await this.executeTool(toolName, toolArgs, input);
          toolExecutions.push(toolExecution);

          // Update the reasoning step with observation
          reasoningSteps[reasoningSteps.length - 1].observation =
            toolExecution.result.success
              ? JSON.stringify(toolExecution.result.data).slice(0, 500)
              : `Error: ${toolExecution.result.error}`;

          // Add tool result to messages
          messages.push({
            role: 'assistant',
            content: '',
            // Tool calls are handled differently
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify(toolExecution.result),
            tool_call_id: toolCall.id
          });
        }
      }

      const duration = Date.now() - startTime;
      const confidence = this.calculateConfidence(reasoningSteps, toolExecutions);

      logger.info({
        duration,
        confidence,
        toolsUsed: toolExecutions.length
      }, 'Agent execution completed');

      return {
        agentType: this.config.type,
        stepId: input.stepId,
        status: confidence >= this.config.confidenceThreshold ? 'success' : 'partial',
        output: finalOutput,
        toolsUsed: toolExecutions,
        reasoning: this.buildReasoningChain(reasoningSteps, finalOutput),
        confidence,
        duration,
        tokensUsed: this.estimateTokens(messages)
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error }, 'Agent execution failed');

      return {
        agentType: this.config.type,
        stepId: input.stepId,
        status: 'failed',
        output: null,
        toolsUsed: toolExecutions,
        reasoning: {
          steps: reasoningSteps,
          conclusion: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          alternativesConsidered: [],
          assumptions: []
        },
        confidence: 0,
        duration,
        tokensUsed: 0
      };
    }
  }

  // ===========================================
  // ABSTRACT METHODS (Implemented by specialized agents)
  // ===========================================

  protected abstract getSpecializedSystemPrompt(): string;
  protected abstract getSpecializedCapabilities(): string[];
  protected abstract parseOutput(content: string): JSONValue;
  protected abstract getToolPurpose(toolName: string, args: JSONObject): string;

  // ===========================================
  // PROMPT BUILDERS
  // ===========================================

  protected buildSystemPrompt(input: AgentInput): string {
    const basePrompt = `You are ${this.config.name}, a specialized AI agent.

ROLE: ${this.config.description}

CAPABILITIES:
${this.config.capabilities.map(c => `- ${c}`).join('\n')}

${this.getSpecializedSystemPrompt()}

CONSTRAINTS:
- Maximum tool calls: ${input.constraints.maxToolCalls}
- Allowed tools: ${input.constraints.allowedTools.join(', ') || 'None'}
${input.constraints.forbiddenActions.length > 0 ? `- Forbidden actions: ${input.constraints.forbiddenActions.join(', ')}` : ''}
${input.constraints.requireExplanation ? '- You MUST explain your reasoning for each decision' : ''}

CRITICAL INSTRUCTIONS FOR TOOL USAGE:
1. You MUST use the provided tools to gather real data before answering any question
2. DO NOT describe what you would do - actually call the tools
3. DO NOT make up or estimate data - query the database using tools
4. If you need financial data, call query_financial_data first
5. If you need metrics, call query_metrics first
6. Always call at least one tool before providing your final answer
7. Base your response ONLY on data returned from tool calls

REASONING APPROACH:
1. Analyze the task and identify what information you need
2. IMMEDIATELY call the appropriate tools to gather real data
3. Wait for tool results before forming conclusions
4. Synthesize the actual data from tools into actionable insights
5. Provide confidence scores based on the quality of data retrieved

RESPONSE FORMAT:
Provide structured, clear responses based on actual data from tools. Include specific numbers and facts from your tool calls.`;

    return basePrompt;
  }

  protected buildUserPrompt(input: AgentInput): string {
    let prompt = `TASK: ${input.instruction}\n\n`;

    if (input.context.relevantMemories.length > 0) {
      prompt += `RELEVANT CONTEXT:\n${input.context.relevantMemories.map(m => `- ${m.content}`).join('\n')}\n\n`;
    }

    if (input.context.domainKnowledge.length > 0) {
      prompt += `APPLICABLE RULES:\n${input.context.domainKnowledge.map(r => `- ${r.name}: ${r.description}`).join('\n')}\n\n`;
    }

    if (input.context.previousResults.length > 0) {
      prompt += `PREVIOUS AGENT RESULTS:\n${input.context.previousResults.map(r =>
        `- ${r.agentType}: ${JSON.stringify(r.output).slice(0, 200)}`
      ).join('\n')}\n\n`;
    }

    prompt += 'Please complete this task and provide your analysis.';

    return prompt;
  }

  // ===========================================
  // TOOL HANDLING
  // ===========================================

  protected buildToolDefinitions(allowedTools: string[]): LLMTool[] {
    const tools = allowedTools.length > 0
      ? allowedTools.filter(t => this.config.tools.includes(t))
      : this.config.tools;

    return tools.map(toolName => {
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) return null;

      // Convert Zod schema to JSON Schema for OpenAI
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonSchema = zodToJsonSchema(tool.inputSchema as any, {
        $refStrategy: 'none',
        target: 'openApi3'
      }) as JSONObject;

      // Remove the $schema property as OpenAI doesn't need it
      delete jsonSchema['$schema'];

      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: jsonSchema
        }
      };
    }).filter((t): t is LLMTool => t !== null);
  }

  protected async executeTool(
    toolName: string,
    params: JSONObject,
    input: AgentInput
  ): Promise<ToolExecution> {
    const startTime = Date.now();

    try {
      const result = await this.toolRegistry.executeTool(toolName, params, {
        userId: input.taskId, // In real implementation, pass actual userId
        sessionId: input.taskId,
        permissions: [],
        timeout: input.constraints.timeout,
        sandboxed: true
      });

      return {
        toolName,
        params,
        result,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        toolName,
        params,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed'
        },
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  // ===========================================
  // HELPERS
  // ===========================================

  protected calculateConfidence(steps: ReasoningStep[], executions: ToolExecution[]): number {
    if (steps.length === 0) return 0;

    // Base confidence from reasoning steps
    const stepConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;

    // Adjust based on tool execution success rate
    const successfulTools = executions.filter(e => e.result.success).length;
    const toolSuccessRate = executions.length > 0
      ? successfulTools / executions.length
      : 1;

    // Combine scores
    return Math.min(1, stepConfidence * 0.7 + toolSuccessRate * 0.3);
  }

  protected buildReasoningChain(steps: ReasoningStep[], output: JSONValue): ReasoningChain {
    return {
      steps,
      conclusion: typeof output === 'string' ? output : JSON.stringify(output),
      alternativesConsidered: this.extractAlternatives(steps),
      assumptions: this.extractAssumptions(steps)
    };
  }

  protected extractAlternatives(steps: ReasoningStep[]): string[] {
    // Extract any alternatives mentioned in thoughts
    return steps
      .filter(s => s.thought.toLowerCase().includes('alternatively') ||
        s.thought.toLowerCase().includes('could also'))
      .map(s => s.thought);
  }

  protected extractAssumptions(steps: ReasoningStep[]): string[] {
    return steps
      .filter(s => s.thought.toLowerCase().includes('assuming') ||
        s.thought.toLowerCase().includes('given that'))
      .map(s => s.thought);
  }

  protected estimateTokens(messages: LLMMessage[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }
}






