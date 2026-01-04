// ===========================================
// NEXUS AI PLATFORM - API CLIENT
// ===========================================

const API_BASE = '/api';

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionStorage.getItem('sessionId') || `session-${Date.now()}`,
      ...options.headers,
    },
    ...options,
  });

  const json: APIResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data as T;
}

// ===========================================
// CHAT API
// ===========================================

export interface ChatResponse {
  taskId: string;
  response: string;
  status: 'completed' | 'awaiting_input' | 'awaiting_approval' | 'failed';
  explanation: {
    summary: string;
    reasoning: string;
    dataSources: string[];
    confidence: number;
    limitations: string[];
    alternativeApproaches: string[];
  };
  metadata: {
    duration: number;
    agentsUsed: string[];
    confidenceScores: number[];
  };
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ===========================================
// DASHBOARD API
// ===========================================

export interface DashboardData {
  insights: ProactiveInsight[];
  stats: {
    totalActions: number;
    aiDecisions: number;
    errors: number;
    topActions: Array<{ action: string; count: number }>;
  };
  recentDecisions: Array<{
    taskId: string;
    intent: string;
    status: string;
    confidence: number;
    agents: string[];
  }>;
}

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/dashboard');
}

// ===========================================
// INSIGHTS API
// ===========================================

export interface ProactiveInsight {
  id: string;
  type: 'anomaly' | 'opportunity' | 'trend' | 'risk' | 'optimization';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  dataPoints: Array<{
    metric: string;
    value: number;
    timestamp: string;
    context?: string;
  }>;
  suggestedActions: Array<{
    id: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    requiresApproval: boolean;
    automatable: boolean;
  }>;
  createdAt: string;
}

export async function getInsights(type?: string, limit = 20): Promise<{ insights: ProactiveInsight[] }> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('limit', String(limit));
  return request<{ insights: ProactiveInsight[] }>(`/insights?${params}`);
}

export async function acknowledgeInsight(insightId: string): Promise<{ acknowledged: boolean }> {
  return request<{ acknowledged: boolean }>(`/insights/${insightId}/acknowledge`, {
    method: 'POST',
  });
}

// ===========================================
// AUDIT API
// ===========================================

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
}

export interface AuditStats {
  totalActions: number;
  aiDecisions: number;
  errors: number;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
}

export async function getAuditLogs(params?: {
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
  }
  return request<{ logs: AuditLog[]; total: number }>(`/audit?${searchParams}`);
}

export async function getAuditStats(): Promise<AuditStats> {
  return request<AuditStats>('/audit/stats');
}

export interface AIDecision {
  taskId: string;
  intent: {
    normalizedQuery: string;
    category: string;
    confidence: number;
  };
  plan: {
    complexity: string;
    steps: Array<{ action: string; agentType: string }>;
  };
  execution: {
    status: string;
    agentsInvolved: string[];
    toolsUsed: string[];
    totalDuration: number;
    totalTokens: number;
  };
  explanation: {
    summary: string;
    reasoning: string;
    confidence: number;
  };
}

export async function getAIDecisions(limit = 20): Promise<{ decisions: AIDecision[] }> {
  return request<{ decisions: AIDecision[] }>(`/audit/decisions?limit=${limit}`);
}

export async function getExplanation(taskId: string): Promise<{ explanation: AIDecision['explanation'] }> {
  return request<{ explanation: AIDecision['explanation'] }>(`/audit/explanation/${taskId}`);
}

// ===========================================
// AGENTS API
// ===========================================

export interface AgentInfo {
  type: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
}

export async function getAgents(): Promise<{ agents: AgentInfo[] }> {
  return request<{ agents: AgentInfo[] }>('/agents');
}

// ===========================================
// TOOLS API
// ===========================================

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  riskLevel: string;
}

export async function getTools(): Promise<{ tools: ToolInfo[] }> {
  return request<{ tools: ToolInfo[] }>('/tools');
}






