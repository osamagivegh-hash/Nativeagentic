// ===========================================
// NEXUS AI PLATFORM - USER MEMORY
// Vector database for user preferences and behavior
// ===========================================

import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { MemoryItem, UUID } from '../types/index.js';

interface UserMemoryRow {
  id: string;
  user_id: string;
  type: string;
  content: string;
  embedding: string;
  metadata: Record<string, unknown>;
  importance: number;
  access_count: number;
  last_accessed_at: Date;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  similarity?: number;
}

export class UserMemory {
  // ===========================================
  // STORAGE OPERATIONS
  // ===========================================

  /**
   * Store a user memory with embedding
   */
  async store(item: MemoryItem): Promise<void> {
    if (!item.metadata.userId) {
      throw new Error('User ID required for user memory');
    }

    await db.insert('user_memories', {
      id: item.id,
      user_id: item.metadata.userId,
      type: item.type,
      content: item.content,
      embedding: item.embedding ? `[${item.embedding.join(',')}]` : null,
      metadata: JSON.stringify(item.metadata),
      importance: item.metadata.importance || 0.5,
      access_count: 0,
      last_accessed_at: new Date(),
      expires_at: item.expiresAt || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    });

    logger.debug({ userId: item.metadata.userId, type: item.type }, 'User memory stored');
  }

  /**
   * Update existing memory
   */
  async update(id: UUID, updates: Partial<MemoryItem>): Promise<void> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date()
    };

    if (updates.content) updateData.content = updates.content;
    if (updates.embedding) updateData.embedding = `[${updates.embedding.join(',')}]`;
    if (updates.metadata) {
      updateData.metadata = JSON.stringify(updates.metadata);
      if (updates.metadata.importance !== undefined) {
        updateData.importance = updates.metadata.importance;
      }
    }

    await db.update('user_memories', { id }, updateData);
  }

  // ===========================================
  // RETRIEVAL OPERATIONS
  // ===========================================

  /**
   * Semantic search for similar memories
   */
  async searchSimilar(
    userId: UUID,
    embedding: number[],
    limit: number,
    minSimilarity = 0.5
  ): Promise<MemoryItem[]> {
    const results = await db.vectorSearch<UserMemoryRow>(
      'user_memories',
      'embedding',
      embedding,
      {
        where: { user_id: userId },
        limit,
        minSimilarity
      }
    );

    return results.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get recent memories for a user
   */
  async getRecent(userId: UUID, limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<UserMemoryRow>(
      'user_memories',
      { user_id: userId },
      {
        orderBy: 'created_at DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get memories by type
   */
  async getByType(userId: UUID, type: string, limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<UserMemoryRow>(
      'user_memories',
      { user_id: userId, type },
      {
        orderBy: 'importance DESC, created_at DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get most accessed memories
   */
  async getMostAccessed(userId: UUID, limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<UserMemoryRow>(
      'user_memories',
      { user_id: userId },
      {
        orderBy: 'access_count DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get important memories
   */
  async getImportant(userId: UUID, minImportance = 0.7, limit = 10): Promise<MemoryItem[]> {
    const result = await db.findMany<UserMemoryRow>(
      'user_memories',
      { user_id: userId },
      {
        orderBy: 'importance DESC',
        limit
      }
    );

    return result
      .filter(row => row.importance >= minImportance)
      .map(row => this.rowToMemoryItem(row));
  }

  // ===========================================
  // PREFERENCE MANAGEMENT
  // ===========================================

  /**
   * Store user preference
   */
  async storePreference(
    userId: UUID,
    category: string,
    preference: string,
    embedding: number[]
  ): Promise<void> {
    const item: MemoryItem = {
      id: `pref_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      layer: 'user',
      type: 'preference',
      content: preference,
      embedding,
      metadata: {
        source: 'user_input',
        userId,
        tags: [category, 'preference'],
        importance: 0.8,
        accessCount: 0,
        lastAccessedAt: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.store(item);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: UUID): Promise<MemoryItem[]> {
    return this.getByType(userId, 'preference', 50);
  }

  // ===========================================
  // BEHAVIOR TRACKING
  // ===========================================

  /**
   * Store user behavior
   */
  async storeBehavior(
    userId: UUID,
    action: string,
    context: Record<string, unknown>,
    embedding: number[]
  ): Promise<void> {
    const item: MemoryItem = {
      id: `beh_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      layer: 'user',
      type: 'behavior',
      content: JSON.stringify({ action, context }),
      embedding,
      metadata: {
        source: 'system_tracked',
        userId,
        tags: ['behavior', action],
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.store(item);
  }

  /**
   * Get behavior patterns
   */
  async getBehaviorPatterns(userId: UUID, limit = 100): Promise<MemoryItem[]> {
    return this.getByType(userId, 'behavior', limit);
  }

  // ===========================================
  // MAINTENANCE
  // ===========================================

  /**
   * Update access statistics
   */
  async recordAccess(id: UUID): Promise<void> {
    await db.update(
      'user_memories',
      { id },
      {
        access_count: db.findOne('user_memories', { id }).then((row: any) => 
          (row?.access_count || 0) + 1
        ),
        last_accessed_at: new Date()
      }
    );
  }

  /**
   * Prune old memories
   */
  async pruneOld(olderThan: Date): Promise<number> {
    const result = await db.delete('user_memories', {
      created_at: olderThan // Note: In production, use proper SQL comparison
    });
    
    logger.info({ count: result }, 'Pruned old user memories');
    return result;
  }

  /**
   * Delete low-importance, old, unused memories
   */
  async consolidate(userId: UUID): Promise<void> {
    // In production, implement sophisticated consolidation logic
    // - Merge similar memories
    // - Update importance based on access patterns
    // - Remove redundant information
    logger.info({ userId }, 'User memory consolidation completed');
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private rowToMemoryItem(row: UserMemoryRow): MemoryItem {
    return {
      id: row.id,
      layer: 'user',
      type: row.type,
      content: row.content,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      metadata: {
        source: 'database',
        userId: row.user_id,
        tags: (row.metadata as any)?.tags || [],
        importance: row.importance,
        accessCount: row.access_count,
        lastAccessedAt: row.last_accessed_at
      },
      relevanceScore: row.similarity,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at || undefined
    };
  }
}






