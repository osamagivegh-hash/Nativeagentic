// ===========================================
// NEXUS AI PLATFORM - CORE TYPE DEFINITIONS
// ===========================================

import { z } from 'zod';

// ===========================================
// COMMON TYPES
// ===========================================

export type UUID = string;
export type Timestamp = Date | string;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue; }
export type JSONArray = JSONValue[];

// ===========================================
// USER & AUTHENTICATION
// ===========================================

export const UserRoleSchema = z.enum([
  'admin',
  'analyst',
  'operator',
  'viewer',
  'system'
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPreferences {
  timezone: string;
  language: string;
  notificationChannels: string[];
  dashboardLayout: JSONObject;
  aiInteractionStyle: 'concise' | 'detailed' | 'conversational';
}

// ===========================================
// AI ORCHESTRATOR TYPES
// ===========================================

export const TaskComplexitySchema = z.enum([
  'simple',      // Single agent, single tool
  'moderate',    // Single agent, multiple tools
  'complex',     // Multiple agents, coordination required
  'critical'     // Requires human approval
]);
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

export const ExecutionStatusSchema = z.enum([
  'pending',
  'planning',
  'executing',
  'validating',
  'completed',
  'failed',
  'cancelled',
  'awaiting_approval'
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export interface Intent {
  id: UUID;
  rawInput: string;
  normalizedQuery: string;
  category: string;
  subcategory: string;
  entities: ExtractedEntity[];
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestions?: string[];
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  source: 'explicit' | 'inferred' | 'context';
}

export interface TaskPlan {
  id: UUID;
  intentId: UUID;
  complexity: TaskComplexity;
  steps: TaskStep[];
  estimatedDuration: number;
  requiredAgents: AgentType[];
  requiredTools: string[];
  riskAssessment: RiskAssessment;
  createdAt: Timestamp;
}

export interface TaskStep {
  id: UUID;
  order: number;
  agentType: AgentType;
  action: string;
  toolCalls: PlannedToolCall[];
  dependencies: UUID[];
  canParallelize: boolean;
  timeout: number;
}

export interface PlannedToolCall {
  toolName: string;
  purpose: string;
  estimatedParams: JSONObject;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  mitigations: string[];
  requiresApproval: boolean;
}

export interface RiskFactor {
  type: string;
  description: string;
  severity: number;
}

// ===========================================
// AGENT TYPES
// ===========================================

export const AgentTypeSchema = z.enum([
  'financial',
  'compliance',
  'user_insight',
  'operations',
  'strategy'
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  systemPrompt: string;
  maxToolCalls: number;
  timeout: number;
  confidenceThreshold: number;
}

export interface AgentInput {
  taskId: UUID;
  stepId: UUID;
  instruction: string;
  context: AgentContext;
  constraints: AgentConstraints;
}

export interface AgentContext {
  conversationHistory: Message[];
  relevantMemories: MemoryItem[];
  domainKnowledge: DomainRule[];
  previousResults: AgentResult[];
}

export interface AgentConstraints {
  maxToolCalls: number;
  timeout: number;
  allowedTools: string[];
  forbiddenActions: string[];
  requireExplanation: boolean;
}

export interface AgentResult {
  agentType: AgentType;
  stepId: UUID;
  status: 'success' | 'partial' | 'failed';
  output: JSONValue;
  toolsUsed: ToolExecution[];
  reasoning: ReasoningChain;
  confidence: number;
  duration: number;
  tokensUsed: number;
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  conclusion: string;
  alternativesConsidered: string[];
  assumptions: string[];
}

export interface ReasoningStep {
  thought: string;
  action: string;
  observation: string;
  confidence: number;
}

// ===========================================
// TOOL TYPES
// ===========================================

export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  requiresPermission: string[];
  riskLevel: 'read' | 'write' | 'destructive';
  execute: (params: JSONObject, context: ToolContext) => Promise<ToolResult>;
}

export type ToolCategory = 
  | 'database'
  | 'calculation'
  | 'report'
  | 'workflow'
  | 'external_api'
  | 'system';

export interface ToolContext {
  userId: UUID;
  sessionId: UUID;
  permissions: string[];
  timeout: number;
  sandboxed: boolean;
}

export interface ToolExecution {
  toolName: string;
  params: JSONObject;
  result: ToolResult;
  duration: number;
  timestamp: Timestamp;
}

export interface ToolResult {
  success: boolean;
  data?: JSONValue;
  error?: string;
  metadata?: {
    rowsAffected?: number;
    cacheHit?: boolean;
    source?: string;
  };
}

// ===========================================
// MEMORY TYPES
// ===========================================

export type MemoryLayer = 
  | 'short_term'    // Redis - session/conversation
  | 'user'          // Vector DB - user preferences/behavior
  | 'domain'        // PostgreSQL - business rules
  | 'operational';  // PostgreSQL - system learnings

export interface MemoryItem {
  id: UUID;
  layer: MemoryLayer;
  type: string;
  content: string;
  embedding?: number[];
  metadata: MemoryMetadata;
  relevanceScore?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface MemoryMetadata {
  source: string;
  userId?: UUID;
  sessionId?: UUID;
  tags: string[];
  importance: number;
  accessCount: number;
  lastAccessedAt: Timestamp;
}

export interface MemoryQuery {
  layer: MemoryLayer;
  query?: string;
  embedding?: number[];
  filters?: Record<string, unknown>;
  limit: number;
  minRelevance?: number;
}

// ===========================================
// DOMAIN KNOWLEDGE TYPES
// ===========================================

export interface DomainRule {
  id: UUID;
  category: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
}

// ===========================================
// PROACTIVE INTELLIGENCE TYPES
// ===========================================

export interface ProactiveInsight {
  id: UUID;
  type: InsightType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  dataPoints: DataPoint[];
  suggestedActions: SuggestedAction[];
  expiresAt?: Timestamp;
  createdAt: Timestamp;
}

export type InsightType = 
  | 'anomaly'
  | 'opportunity'
  | 'trend'
  | 'risk'
  | 'optimization';

export interface DataPoint {
  metric: string;
  value: number;
  timestamp: Timestamp;
  context?: string;
}

export interface SuggestedAction {
  id: UUID;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  automatable: boolean;
}

// ===========================================
// AUDIT & EXPLAINABILITY TYPES
// ===========================================

export interface AuditLog {
  id: UUID;
  timestamp: Timestamp;
  userId: UUID;
  sessionId: UUID;
  action: string;
  resource: string;
  details: AuditDetails;
  aiDecision?: AIDecisionLog;
}

export interface AuditDetails {
  input: JSONValue;
  output: JSONValue;
  changes?: JSONObject;
  ipAddress?: string;
  userAgent?: string;
}

export interface AIDecisionLog {
  taskId: UUID;
  intent: Intent;
  plan: TaskPlan;
  execution: ExecutionSummary;
  explanation: Explanation;
}

export interface ExecutionSummary {
  status: ExecutionStatus;
  agentsInvolved: AgentType[];
  toolsUsed: string[];
  totalDuration: number;
  totalTokens: number;
  retryCount: number;
}

export interface Explanation {
  summary: string;
  reasoning: string;
  dataSources: string[];
  confidence: number;
  limitations: string[];
  alternativeApproaches: string[];
}

// ===========================================
// MESSAGE & CONVERSATION TYPES
// ===========================================

export interface Message {
  id: UUID;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: {
    toolCalls?: ToolExecution[];
    agentType?: AgentType;
    confidence?: number;
  };
  timestamp: Timestamp;
}

export interface Conversation {
  id: UUID;
  userId: UUID;
  messages: Message[];
  context: ConversationContext;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConversationContext {
  currentTopic?: string;
  activeTask?: UUID;
  mentionedEntities: ExtractedEntity[];
  userMood?: string;
}

// ===========================================
// API RESPONSE TYPES
// ===========================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: ResponseMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: JSONObject;
}

export interface ResponseMeta {
  requestId: UUID;
  timestamp: Timestamp;
  duration: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ===========================================
// REQUEST TYPES
// ===========================================

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  context: z.object({
    urgency: z.enum(['low', 'normal', 'high']).optional(),
    preferredAgents: z.array(AgentTypeSchema).optional(),
    maxTokens: z.number().optional()
  }).optional()
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ApprovalRequestSchema = z.object({
  taskId: z.string().uuid(),
  approved: z.boolean(),
  comments: z.string().optional(),
  modifications: z.record(z.unknown()).optional()
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;






