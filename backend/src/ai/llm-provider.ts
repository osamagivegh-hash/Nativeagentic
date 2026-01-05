// ===========================================
// NEXUS AI PLATFORM - LLM PROVIDER
// Model-agnostic wrapper for LLM interactions
// ===========================================

import OpenAI from 'openai';
import { aiConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { JSONObject, JSONValue } from '../types/index.js';

// Initialize OpenAI client (compatible with other providers)
const openai = new OpenAI({
  apiKey: aiConfig.apiKey,
  baseURL: aiConfig.baseUrl
});

// ===========================================
// TYPES
// ===========================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONObject;
  };
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: { type: 'json_object' | 'text' };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMCompletionResponse {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ===========================================
// COMPLETION FUNCTIONS
// ===========================================

export async function complete(
  request: LLMCompletionRequest
): Promise<LLMCompletionResponse> {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: request.model || aiConfig.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        name: m.name,
        tool_call_id: m.tool_call_id
      })),
      tools: request.tools,
      tool_choice: request.toolChoice,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      response_format: request.responseFormat
    });

    const choice = response.choices[0];
    const duration = Date.now() - startTime;

    logger.debug({
      model: request.model || aiConfig.model,
      duration,
      tokens: response.usage
    }, 'LLM completion finished');

    return {
      content: choice.message.content,
      toolCalls: (choice.message.tool_calls || []).map(tc => {
        const toolCall = tc as any;
        return {
          id: toolCall.id,
          type: toolCall.type as "function",
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        };
      }),
      finishReason: choice.finish_reason || 'stop',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }
    };
  } catch (error) {
    logger.error({ error }, 'LLM completion failed');
    throw error;
  }
}

// Streaming completion
export async function* streamComplete(
  request: LLMCompletionRequest
): AsyncGenerator<{ type: 'content' | 'tool_call'; data: string }> {
  const stream = await openai.chat.completions.create({
    model: request.model || aiConfig.model,
    messages: request.messages.map(m => ({
      role: m.role,
      content: m.content,
      name: m.name,
      tool_call_id: m.tool_call_id
    })),
    tools: request.tools,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 4096,
    stream: true
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      yield { type: 'content', data: delta.content };
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.arguments) {
          yield { type: 'tool_call', data: tc.function.arguments };
        }
      }
    }
  }
}

// ===========================================
// EMBEDDING FUNCTIONS
// ===========================================

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: aiConfig.embeddingModel,
    input: text
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: aiConfig.embeddingModel,
    input: texts
  });
  return response.data.map(d => d.embedding);
}

// ===========================================
// STRUCTURED OUTPUT HELPERS
// ===========================================

export async function completeWithSchema<T>(
  messages: LLMMessage[],
  schema: JSONObject,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<T> {
  // Add schema instruction to system message
  const systemMessage: LLMMessage = {
    role: 'system',
    content: `You must respond with valid JSON that matches this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any text outside the JSON.`
  };

  const response = await complete({
    messages: [systemMessage, ...messages],
    temperature: options.temperature ?? 0.3,
    maxTokens: options.maxTokens,
    responseFormat: { type: 'json_object' }
  });

  try {
    return JSON.parse(response.content || '{}') as T;
  } catch {
    logger.error({ content: response.content }, 'Failed to parse LLM JSON response');
    throw new Error('Invalid JSON response from LLM');
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

export function buildToolDefinition(
  name: string,
  description: string,
  parameters: JSONObject
): LLMTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters
    }
  };
}

export function parseToolArguments<T = JSONObject>(args: string): T {
  try {
    return JSON.parse(args) as T;
  } catch {
    logger.error({ args }, 'Failed to parse tool arguments');
    throw new Error('Invalid tool arguments');
  }
}






