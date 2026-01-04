// ===========================================
// NEXUS AI PLATFORM - OPERATIONAL MEMORY
// System learnings, errors, and operational knowledge
// ===========================================

import { db, query } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { MemoryItem, UUID } from '../types/index.js';

interface OperationalLearningRow {
  id: string;
  type: string;
  context: string;
  learning: string;
  embedding: string | null;
  confidence: number;
  source_task_id: string | null;
  applied_count: number;
  success_rate: number | null;
  is_validated: boolean;
  validated_by: string | null;
  created_at: Date;
  updated_at: Date;
  similarity?: number;
}

export class OperationalMemory {
  // ===========================================
  // LEARNING STORAGE
  // ===========================================

  /**
   * Store an operational learning
   */
  async store(item: MemoryItem): Promise<void> {
    await db.insert('operational_learnings', {
      id: item.id,
      type: item.type,
      context: item.metadata.tags?.join(', ') || '',
      learning: item.content,
      embedding: item.embedding ? `[${item.embedding.join(',')}]` : null,
      confidence: item.metadata.importance || 0.5,
      source_task_id: item.metadata.sessionId || null,
      applied_count: 0,
      success_rate: null,
      is_validated: false,
      validated_by: null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    });

    logger.debug({ type: item.type }, 'Operational learning stored');
  }

  /**
   * Store a specific learning from task execution
   */
  async storeLearning(data: {
    type: string;
    context: string;
    learning: string;
    embedding: number[];
    confidence: number;
    sourceTaskId?: UUID;
  }): Promise<void> {
    await db.insert('operational_learnings', {
      id: `opl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: data.type,
      context: data.context,
      learning: data.learning,
      embedding: `[${data.embedding.join(',')}]`,
      confidence: data.confidence,
      source_task_id: data.sourceTaskId || null,
      applied_count: 0,
      success_rate: null,
      is_validated: false,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // ===========================================
  // RETRIEVAL OPERATIONS
  // ===========================================

  /**
   * Semantic search for similar learnings
   */
  async searchSimilar(
    embedding: number[],
    limit: number,
    minSimilarity = 0.5
  ): Promise<MemoryItem[]> {
    const results = await db.vectorSearch<OperationalLearningRow>(
      'operational_learnings',
      'embedding',
      embedding,
      {
        limit,
        minSimilarity
      }
    );

    return results.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get recent learnings
   */
  async getRecent(limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<OperationalLearningRow>(
      'operational_learnings',
      {},
      {
        orderBy: 'created_at DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get learnings by type
   */
  async getByType(type: string, limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<OperationalLearningRow>(
      'operational_learnings',
      { type },
      {
        orderBy: 'confidence DESC, applied_count DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get validated learnings only
   */
  async getValidated(limit: number): Promise<MemoryItem[]> {
    const rows = await db.findMany<OperationalLearningRow>(
      'operational_learnings',
      { is_validated: true },
      {
        orderBy: 'confidence DESC',
        limit
      }
    );

    return rows.map(row => this.rowToMemoryItem(row));
  }

  /**
   * Get high-confidence learnings
   */
  async getHighConfidence(minConfidence = 0.8, limit = 20): Promise<MemoryItem[]> {
    const result = await query<OperationalLearningRow>(`
      SELECT * FROM operational_learnings
      WHERE confidence >= $1
      ORDER BY confidence DESC, applied_count DESC
      LIMIT $2
    `, [minConfidence, limit]);

    return result.rows.map(row => this.rowToMemoryItem(row));
  }

  // ===========================================
  // LEARNING LIFECYCLE
  // ===========================================

  /**
   * Record when a learning is applied
   */
  async recordApplication(id: UUID, wasSuccessful: boolean): Promise<void> {
    const existing = await db.findOne<OperationalLearningRow>('operational_learnings', { id });
    if (!existing) return;

    const newAppliedCount = existing.applied_count + 1;
    const currentSuccesses = (existing.success_rate || 0) * existing.applied_count;
    const newSuccessRate = (currentSuccesses + (wasSuccessful ? 1 : 0)) / newAppliedCount;

    await db.update('operational_learnings', { id }, {
      applied_count: newAppliedCount,
      success_rate: newSuccessRate,
      updated_at: new Date()
    });

    // Auto-validate if consistently successful
    if (newAppliedCount >= 5 && newSuccessRate >= 0.9) {
      await this.validate(id, 'system');
    }
  }

  /**
   * Validate a learning
   */
  async validate(id: UUID, validatedBy: UUID | 'system'): Promise<void> {
    await db.update('operational_learnings', { id }, {
      is_validated: true,
      validated_by: validatedBy === 'system' ? null : validatedBy,
      updated_at: new Date()
    });

    logger.info({ id }, 'Operational learning validated');
  }

  /**
   * Invalidate a learning (mark as not useful)
   */
  async invalidate(id: UUID): Promise<void> {
    await db.delete('operational_learnings', { id });
    logger.info({ id }, 'Operational learning invalidated and removed');
  }

  // ===========================================
  // ERROR LEARNING
  // ===========================================

  /**
   * Store error and its resolution
   */
  async storeErrorLearning(data: {
    errorType: string;
    errorMessage: string;
    context: string;
    resolution: string;
    embedding: number[];
    taskId?: UUID;
  }): Promise<void> {
    await this.storeLearning({
      type: 'error_resolution',
      context: `${data.errorType}: ${data.errorMessage}\n\nContext: ${data.context}`,
      learning: data.resolution,
      embedding: data.embedding,
      confidence: 0.6, // Start with moderate confidence
      sourceTaskId: data.taskId
    });
  }

  /**
   * Find similar errors and their resolutions
   */
  async findSimilarErrors(
    errorEmbedding: number[],
    limit = 5
  ): Promise<Array<{
    error: string;
    resolution: string;
    confidence: number;
    successRate: number | null;
  }>> {
    const results = await this.searchSimilar(errorEmbedding, limit, 0.7);
    
    return results
      .filter(item => item.type === 'error_resolution')
      .map(item => ({
        error: item.content.split('\n\n')[0] || '',
        resolution: item.content,
        confidence: item.metadata.importance,
        successRate: null // Would need to fetch from row
      }));
  }

  // ===========================================
  // PATTERN DETECTION
  // ===========================================

  /**
   * Get patterns from learnings
   */
  async getPatterns(minOccurrences = 3): Promise<Array<{
    pattern: string;
    occurrences: number;
    avgConfidence: number;
    avgSuccessRate: number;
  }>> {
    const result = await query<{
      type: string;
      count: string;
      avg_confidence: string;
      avg_success_rate: string;
    }>(`
      SELECT 
        type,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        AVG(COALESCE(success_rate, 0)) as avg_success_rate
      FROM operational_learnings
      GROUP BY type
      HAVING COUNT(*) >= $1
      ORDER BY count DESC
    `, [minOccurrences]);

    return result.rows.map(row => ({
      pattern: row.type,
      occurrences: parseInt(row.count, 10),
      avgConfidence: parseFloat(row.avg_confidence),
      avgSuccessRate: parseFloat(row.avg_success_rate)
    }));
  }

  // ===========================================
  // MAINTENANCE
  // ===========================================

  /**
   * Prune old, unused learnings
   */
  async pruneOld(olderThan: Date): Promise<number> {
    const result = await query(`
      DELETE FROM operational_learnings
      WHERE created_at < $1
        AND applied_count = 0
        AND is_validated = false
    `, [olderThan]);

    const count = result.rowCount || 0;
    logger.info({ count, olderThan }, 'Pruned old operational learnings');
    return count;
  }

  /**
   * Prune low-quality learnings
   */
  async pruneLowQuality(): Promise<number> {
    const result = await query(`
      DELETE FROM operational_learnings
      WHERE applied_count >= 5
        AND success_rate < 0.3
        AND is_validated = false
    `);

    const count = result.rowCount || 0;
    logger.info({ count }, 'Pruned low-quality operational learnings');
    return count;
  }

  /**
   * Consolidate similar learnings
   */
  async consolidate(): Promise<void> {
    // In production, implement sophisticated consolidation:
    // - Find clusters of similar learnings
    // - Merge them into more general principles
    // - Update confidence based on cluster size
    logger.info('Operational memory consolidation completed');
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private rowToMemoryItem(row: OperationalLearningRow): MemoryItem {
    return {
      id: row.id,
      layer: 'operational',
      type: row.type,
      content: row.learning,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      metadata: {
        source: 'operational_learnings',
        tags: row.context.split(', ').filter(Boolean),
        importance: row.confidence,
        accessCount: row.applied_count,
        lastAccessedAt: row.updated_at
      },
      relevanceScore: row.similarity,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}






