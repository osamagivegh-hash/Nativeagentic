// ===========================================
// NEXUS AI PLATFORM - MEMORY MANAGER
// Multi-layer memory system orchestrator
// ===========================================

import { v4 as uuidv4 } from 'uuid';
import { ShortTermMemory } from './short-term.js';
import { UserMemory } from './user-memory.js';
import { DomainMemory } from './domain-memory.js';
import { OperationalMemory } from './operational-memory.js';
import { createEmbedding } from '../ai/llm-provider.js';
import { logger } from '../utils/logger.js';
import {
  MemoryItem,
  MemoryLayer,
  MemoryQuery,
  DomainRule,
  UUID,
  Intent,
  TaskPlan,
  AgentResult
} from '../types/index.js';

// ===========================================
// MEMORY MANAGER CLASS
// ===========================================

export class MemoryManager {
  private shortTerm: ShortTermMemory;
  private userMemory: UserMemory;
  private domainMemory: DomainMemory;
  private operationalMemory: OperationalMemory;

  constructor(
    shortTerm: ShortTermMemory,
    userMemory: UserMemory,
    domainMemory: DomainMemory,
    operationalMemory: OperationalMemory
  ) {
    this.shortTerm = shortTerm;
    this.userMemory = userMemory;
    this.domainMemory = domainMemory;
    this.operationalMemory = operationalMemory;

    logger.info('Memory manager initialized with all layers');
  }

  // ===========================================
  // UNIFIED MEMORY OPERATIONS
  // ===========================================

  /**
   * Store a memory item in the appropriate layer
   */
  async store(
    layer: MemoryLayer,
    content: string,
    metadata: {
      type: string;
      userId?: UUID;
      sessionId?: UUID;
      tags?: string[];
      importance?: number;
      ttl?: number; // seconds, for short-term only
    }
  ): Promise<MemoryItem> {
    const id = uuidv4();
    const now = new Date();

    const item: MemoryItem = {
      id,
      layer,
      type: metadata.type,
      content,
      metadata: {
        source: 'system',
        userId: metadata.userId,
        sessionId: metadata.sessionId,
        tags: metadata.tags || [],
        importance: metadata.importance || 0.5,
        accessCount: 0,
        lastAccessedAt: now
      },
      createdAt: now,
      updatedAt: now
    };

    switch (layer) {
      case 'short_term':
        await this.shortTerm.store(
          metadata.sessionId || id,
          item,
          metadata.ttl || 3600
        );
        break;

      case 'user':
        const userEmbedding = await createEmbedding(content);
        item.embedding = userEmbedding;
        await this.userMemory.store(item);
        break;

      case 'domain':
        await this.domainMemory.store(item);
        break;

      case 'operational':
        const opEmbedding = await createEmbedding(content);
        item.embedding = opEmbedding;
        await this.operationalMemory.store(item);
        break;
    }

    logger.debug({ layer, type: metadata.type }, 'Memory stored');
    return item;
  }

  /**
   * Retrieve memories based on query
   */
  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    let results: MemoryItem[] = [];

    switch (query.layer) {
      case 'short_term':
        results = await this.shortTerm.retrieve(
          query.filters?.sessionId as string,
          query.limit
        );
        break;

      case 'user':
        if (query.query) {
          const embedding = query.embedding || await createEmbedding(query.query);
          results = await this.userMemory.searchSimilar(
            query.filters?.userId as UUID,
            embedding,
            query.limit,
            query.minRelevance
          );
        } else {
          results = await this.userMemory.getRecent(
            query.filters?.userId as UUID,
            query.limit
          );
        }
        break;

      case 'domain':
        results = await this.domainMemory.retrieve(
          query.filters as Record<string, unknown>,
          query.limit
        );
        break;

      case 'operational':
        if (query.query) {
          const embedding = query.embedding || await createEmbedding(query.query);
          results = await this.operationalMemory.searchSimilar(
            embedding,
            query.limit,
            query.minRelevance
          );
        } else {
          results = await this.operationalMemory.getRecent(query.limit);
        }
        break;
    }

    // Update access counts
    await this.updateAccessCounts(results);

    return results;
  }

  /**
   * Search across all memory layers
   */
  async searchAll(
    query: string,
    options: {
      userId?: UUID;
      sessionId?: UUID;
      limit?: number;
      minRelevance?: number;
    } = {}
  ): Promise<Map<MemoryLayer, MemoryItem[]>> {
    const { limit = 5, minRelevance = 0.5 } = options;
    const embedding = await createEmbedding(query);

    const results = new Map<MemoryLayer, MemoryItem[]>();

    // Search all layers in parallel
    const [shortTermResults, userResults, operationalResults] = await Promise.all([
      options.sessionId 
        ? this.shortTerm.search(options.sessionId, query, limit)
        : Promise.resolve([]),
      options.userId
        ? this.userMemory.searchSimilar(options.userId, embedding, limit, minRelevance)
        : Promise.resolve([]),
      this.operationalMemory.searchSimilar(embedding, limit, minRelevance)
    ]);

    results.set('short_term', shortTermResults);
    results.set('user', userResults);
    results.set('operational', operationalResults);

    // Domain memory doesn't use semantic search
    const domainResults = await this.domainMemory.searchByKeywords(query, limit);
    results.set('domain', domainResults);

    return results;
  }

  // ===========================================
  // SPECIALIZED MEMORY OPERATIONS
  // ===========================================

  /**
   * Get conversation context from short-term memory
   */
  async getConversationContext(sessionId: UUID, limit = 10): Promise<MemoryItem[]> {
    return this.shortTerm.retrieve(sessionId, limit);
  }

  /**
   * Store conversation turn
   */
  async storeConversationTurn(
    sessionId: UUID,
    userId: UUID,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<void> {
    await this.store('short_term', content, {
      type: `conversation_${role}`,
      userId,
      sessionId,
      tags: ['conversation'],
      ttl: 7200 // 2 hours
    });
  }

  /**
   * Get relevant user memories for a query
   */
  async getUserMemories(
    userId: UUID,
    query: string,
    limit = 5
  ): Promise<MemoryItem[]> {
    const embedding = await createEmbedding(query);
    return this.userMemory.searchSimilar(userId, embedding, limit, 0.6);
  }

  /**
   * Store user preference
   */
  async storeUserPreference(
    userId: UUID,
    preference: string,
    category: string
  ): Promise<void> {
    await this.store('user', preference, {
      type: 'preference',
      userId,
      tags: [category, 'preference'],
      importance: 0.8
    });
  }

  /**
   * Get relevant domain rules
   */
  async getRelevantDomainRules(context: string): Promise<DomainRule[]> {
    return this.domainMemory.getRulesForContext(context);
  }

  /**
   * Store operational learning
   */
  async storeOperationalLearning(data: {
    taskId: UUID;
    intent: Intent;
    plan: TaskPlan;
    results: AgentResult[];
    success: boolean;
  }): Promise<void> {
    const learning = this.synthesizeLearning(data);
    
    await this.store('operational', learning.content, {
      type: 'task_learning',
      tags: [
        data.intent.category,
        data.success ? 'success' : 'failure',
        ...data.plan.requiredAgents
      ],
      importance: data.success ? 0.7 : 0.9 // Failures are more important to learn from
    });
  }

  /**
   * Get similar past task executions
   */
  async getSimilarTaskExecutions(
    intent: string,
    limit = 3
  ): Promise<MemoryItem[]> {
    const embedding = await createEmbedding(intent);
    return this.operationalMemory.searchSimilar(embedding, limit, 0.7);
  }

  // ===========================================
  // MEMORY MAINTENANCE
  // ===========================================

  /**
   * Consolidate short-term memories into long-term
   */
  async consolidateMemories(sessionId: UUID, userId: UUID): Promise<void> {
    const shortTermItems = await this.shortTerm.retrieve(sessionId, 100);
    
    if (shortTermItems.length === 0) return;

    // Group by type and summarize
    const grouped = this.groupByType(shortTermItems);
    
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        const consolidated = await this.summarizeMemories(items);
        
        await this.store('user', consolidated, {
          type: `consolidated_${type}`,
          userId,
          tags: ['consolidated', type],
          importance: 0.6
        });
      }
    }

    logger.info({ sessionId, count: shortTermItems.length }, 'Memories consolidated');
  }

  /**
   * Prune old memories
   */
  async pruneOldMemories(layer: MemoryLayer, olderThan: Date): Promise<number> {
    switch (layer) {
      case 'user':
        return this.userMemory.pruneOld(olderThan);
      case 'operational':
        return this.operationalMemory.pruneOld(olderThan);
      default:
        return 0;
    }
  }

  // ===========================================
  // HELPER METHODS
  // ===========================================

  private async updateAccessCounts(items: MemoryItem[]): Promise<void> {
    for (const item of items) {
      item.metadata.accessCount++;
      item.metadata.lastAccessedAt = new Date();
      // In production, batch these updates
    }
  }

  private groupByType(items: MemoryItem[]): Record<string, MemoryItem[]> {
    const grouped: Record<string, MemoryItem[]> = {};
    
    for (const item of items) {
      const type = item.type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(item);
    }
    
    return grouped;
  }

  private async summarizeMemories(items: MemoryItem[]): Promise<string> {
    // In production, use LLM to summarize
    const contents = items.map(i => i.content).join(' | ');
    return `Consolidated from ${items.length} items: ${contents.slice(0, 500)}`;
  }

  private synthesizeLearning(data: {
    taskId: UUID;
    intent: Intent;
    plan: TaskPlan;
    results: AgentResult[];
    success: boolean;
  }): { content: string } {
    const agentsSummary = data.results.map(r => 
      `${r.agentType}: ${r.status} (confidence: ${r.confidence})`
    ).join(', ');

    const content = `Task: ${data.intent.normalizedQuery}
Category: ${data.intent.category}
Outcome: ${data.success ? 'Success' : 'Failed'}
Agents: ${agentsSummary}
Key learnings: ${data.results
  .filter(r => r.reasoning.assumptions.length > 0)
  .map(r => r.reasoning.assumptions.join(', '))
  .join('; ')}`;

    return { content };
  }
}

// ===========================================
// FACTORY FUNCTION
// ===========================================

export async function createMemoryManager(
  redisUrl: string,
  redisPrefix: string
): Promise<MemoryManager> {
  const shortTerm = new ShortTermMemory(redisUrl, redisPrefix);
  const userMemory = new UserMemory();
  const domainMemory = new DomainMemory();
  const operationalMemory = new OperationalMemory();

  await shortTerm.connect();

  return new MemoryManager(
    shortTerm,
    userMemory,
    domainMemory,
    operationalMemory
  );
}






