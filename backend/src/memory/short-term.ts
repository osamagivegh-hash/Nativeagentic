// ===========================================
// NEXUS AI PLATFORM - SHORT-TERM MEMORY
// Redis-based session and conversation memory
// ===========================================

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { MemoryItem, UUID } from '../types/index.js';

export class ShortTermMemory {
  private redis: Redis | null = null;
  private redisUrl: string;
  private prefix: string;

  constructor(redisUrl: string, prefix: string) {
    this.redisUrl = redisUrl;
    this.prefix = prefix;
  }

  // ===========================================
  // CONNECTION MANAGEMENT
  // ===========================================

  async connect(): Promise<void> {
    this.redis = new Redis(this.redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.redis.on('connect', () => {
      logger.info('Short-term memory (Redis) connected');
    });

    this.redis.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    // Test connection
    await this.redis.ping();
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      logger.info('Short-term memory (Redis) disconnected');
    }
  }

  private getClient(): Redis {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }
    return this.redis;
  }

  // ===========================================
  // MEMORY OPERATIONS
  // ===========================================

  /**
   * Store a memory item with TTL
   */
  async store(sessionId: string, item: MemoryItem, ttl: number): Promise<void> {
    const client = this.getClient();
    const key = this.buildKey(sessionId, item.id);
    const listKey = this.buildListKey(sessionId);

    const pipeline = client.pipeline();

    // Store the item
    pipeline.setex(key, ttl, JSON.stringify(item));
    
    // Add to session list (sorted by timestamp)
    pipeline.zadd(
      listKey,
      new Date(item.createdAt).getTime(),
      item.id
    );
    
    // Set TTL on the list
    pipeline.expire(listKey, ttl);

    await pipeline.exec();
  }

  /**
   * Retrieve recent memories for a session
   */
  async retrieve(sessionId: string, limit: number): Promise<MemoryItem[]> {
    const client = this.getClient();
    const listKey = this.buildListKey(sessionId);

    // Get most recent item IDs
    const itemIds = await client.zrevrange(listKey, 0, limit - 1);
    
    if (itemIds.length === 0) {
      return [];
    }

    // Get all items
    const keys = itemIds.map(id => this.buildKey(sessionId, id));
    const items = await client.mget(...keys);

    return items
      .filter((item): item is string => item !== null)
      .map(item => JSON.parse(item) as MemoryItem);
  }

  /**
   * Search memories by content (simple text match)
   */
  async search(
    sessionId: string,
    query: string,
    limit: number
  ): Promise<MemoryItem[]> {
    const items = await this.retrieve(sessionId, 100); // Get more for filtering
    const queryLower = query.toLowerCase();

    return items
      .filter(item => item.content.toLowerCase().includes(queryLower))
      .slice(0, limit);
  }

  /**
   * Get specific memory by ID
   */
  async get(sessionId: string, itemId: UUID): Promise<MemoryItem | null> {
    const client = this.getClient();
    const key = this.buildKey(sessionId, itemId);
    
    const data = await client.get(key);
    return data ? JSON.parse(data) as MemoryItem : null;
  }

  /**
   * Delete a specific memory
   */
  async delete(sessionId: string, itemId: UUID): Promise<boolean> {
    const client = this.getClient();
    const key = this.buildKey(sessionId, itemId);
    const listKey = this.buildListKey(sessionId);

    const pipeline = client.pipeline();
    pipeline.del(key);
    pipeline.zrem(listKey, itemId);
    
    const results = await pipeline.exec();
    return results !== null && results[0][1] === 1;
  }

  /**
   * Clear all memories for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    const client = this.getClient();
    const listKey = this.buildListKey(sessionId);

    // Get all item IDs
    const itemIds = await client.zrange(listKey, 0, -1);
    
    if (itemIds.length === 0) {
      return;
    }

    // Delete all items and the list
    const keys = itemIds.map(id => this.buildKey(sessionId, id));
    await client.del(...keys, listKey);
  }

  // ===========================================
  // CONVERSATION SPECIFIC
  // ===========================================

  /**
   * Store conversation message
   */
  async storeMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const item: MemoryItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      layer: 'short_term',
      type: `message_${role}`,
      content,
      metadata: {
        source: 'conversation',
        tags: [role, 'message'],
        importance: role === 'user' ? 0.8 : 0.6,
        accessCount: 0,
        lastAccessedAt: new Date(),
        ...metadata
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.store(sessionId, item, 7200); // 2 hour TTL
  }

  /**
   * Get conversation history
   */
  async getConversation(
    sessionId: string,
    limit = 20
  ): Promise<Array<{ role: string; content: string; timestamp: Date }>> {
    const items = await this.retrieve(sessionId, limit);
    
    return items
      .filter(item => item.type.startsWith('message_'))
      .map(item => ({
        role: item.type.replace('message_', ''),
        content: item.content,
        timestamp: new Date(item.createdAt)
      }))
      .reverse(); // Chronological order
  }

  // ===========================================
  // CONTEXT MANAGEMENT
  // ===========================================

  /**
   * Store task context
   */
  async storeTaskContext(
    sessionId: string,
    taskId: UUID,
    context: Record<string, unknown>
  ): Promise<void> {
    const client = this.getClient();
    const key = `${this.prefix}task:${sessionId}:${taskId}`;
    
    await client.setex(key, 3600, JSON.stringify(context));
  }

  /**
   * Get task context
   */
  async getTaskContext(
    sessionId: string,
    taskId: UUID
  ): Promise<Record<string, unknown> | null> {
    const client = this.getClient();
    const key = `${this.prefix}task:${sessionId}:${taskId}`;
    
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private buildKey(sessionId: string, itemId: string): string {
    return `${this.prefix}stm:${sessionId}:${itemId}`;
  }

  private buildListKey(sessionId: string): string {
    return `${this.prefix}stm:${sessionId}:list`;
  }
}






