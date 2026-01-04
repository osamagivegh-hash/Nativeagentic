// ===========================================
// NEXUS AI PLATFORM - DOMAIN MEMORY
// PostgreSQL-based business rules and domain knowledge
// ===========================================

import { db, query } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { MemoryItem, DomainRule, UUID } from '../types/index.js';

interface DomainRuleRow {
  id: string;
  category: string;
  name: string;
  description: string;
  condition_expr: string;
  action_expr: string;
  priority: number;
  is_active: boolean;
  effective_from: Date;
  effective_to: Date | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class DomainMemory {
  // ===========================================
  // RULE MANAGEMENT
  // ===========================================

  /**
   * Store a domain rule
   */
  async storeRule(rule: Omit<DomainRule, 'id'>): Promise<DomainRule> {
    const result = await db.insert<DomainRuleRow>('domain_rules', {
      category: rule.category,
      name: rule.name,
      description: rule.description || '',
      condition_expr: rule.condition,
      action_expr: rule.action,
      priority: rule.priority,
      is_active: rule.isActive,
      effective_from: rule.effectiveFrom,
      effective_to: rule.effectiveTo || null,
      metadata: JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info({ ruleName: rule.name, category: rule.category }, 'Domain rule stored');

    return this.rowToRule(result);
  }

  /**
   * Update a domain rule
   */
  async updateRule(id: UUID, updates: Partial<DomainRule>): Promise<DomainRule | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.condition !== undefined) updateData.condition_expr = updates.condition;
    if (updates.action !== undefined) updateData.action_expr = updates.action;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.effectiveFrom !== undefined) updateData.effective_from = updates.effectiveFrom;
    if (updates.effectiveTo !== undefined) updateData.effective_to = updates.effectiveTo;

    const result = await db.update<DomainRuleRow>('domain_rules', { id }, updateData);
    return result ? this.rowToRule(result) : null;
  }

  /**
   * Get rule by ID
   */
  async getRule(id: UUID): Promise<DomainRule | null> {
    const row = await db.findOne<DomainRuleRow>('domain_rules', { id });
    return row ? this.rowToRule(row) : null;
  }

  /**
   * Get all active rules
   */
  async getActiveRules(): Promise<DomainRule[]> {
    const now = new Date();
    
    const result = await query<DomainRuleRow>(`
      SELECT * FROM domain_rules 
      WHERE is_active = true 
        AND effective_from <= $1 
        AND (effective_to IS NULL OR effective_to > $1)
      ORDER BY priority DESC, name ASC
    `, [now]);

    return result.rows.map(row => this.rowToRule(row));
  }

  /**
   * Get rules by category
   */
  async getRulesByCategory(category: string): Promise<DomainRule[]> {
    const rows = await db.findMany<DomainRuleRow>(
      'domain_rules',
      { category, is_active: true },
      { orderBy: 'priority DESC' }
    );

    return rows.map(row => this.rowToRule(row));
  }

  /**
   * Get rules relevant to a context
   */
  async getRulesForContext(context: string): Promise<DomainRule[]> {
    // Extract potential keywords from context
    const keywords = this.extractKeywords(context);
    
    if (keywords.length === 0) {
      return this.getActiveRules();
    }

    // Search rules by keywords in name and description
    const result = await query<DomainRuleRow>(`
      SELECT * FROM domain_rules 
      WHERE is_active = true 
        AND effective_from <= NOW() 
        AND (effective_to IS NULL OR effective_to > NOW())
        AND (
          ${keywords.map((_, i) => `
            name ILIKE $${i + 1} OR description ILIKE $${i + 1}
          `).join(' OR ')}
        )
      ORDER BY priority DESC
      LIMIT 20
    `, keywords.map(k => `%${k}%`));

    return result.rows.map(row => this.rowToRule(row));
  }

  // ===========================================
  // GENERIC MEMORY INTERFACE
  // ===========================================

  /**
   * Store a memory item (converts to domain rule)
   */
  async store(item: MemoryItem): Promise<void> {
    await this.storeRule({
      category: item.type,
      name: item.metadata.tags?.[0] || 'Unnamed Rule',
      description: item.content,
      condition: 'true',
      action: item.content,
      priority: Math.round(item.metadata.importance * 100),
      isActive: true,
      effectiveFrom: item.createdAt
    });
  }

  /**
   * Retrieve memory items
   */
  async retrieve(
    filters: Record<string, unknown>,
    limit: number
  ): Promise<MemoryItem[]> {
    const rows = await db.findMany<DomainRuleRow>(
      'domain_rules',
      filters,
      { limit, orderBy: 'priority DESC' }
    );

    return rows.map(row => this.ruleToMemoryItem(this.rowToRule(row)));
  }

  /**
   * Search by keywords
   */
  async searchByKeywords(query: string, limit: number): Promise<MemoryItem[]> {
    const rules = await this.getRulesForContext(query);
    return rules.slice(0, limit).map(rule => this.ruleToMemoryItem(rule));
  }

  // ===========================================
  // RULE EVALUATION
  // ===========================================

  /**
   * Evaluate which rules apply to given data
   */
  async evaluateRules(
    category: string,
    data: Record<string, unknown>
  ): Promise<Array<{ rule: DomainRule; applies: boolean; reason: string }>> {
    const rules = await this.getRulesByCategory(category);
    const results: Array<{ rule: DomainRule; applies: boolean; reason: string }> = [];

    for (const rule of rules) {
      try {
        const applies = this.evaluateCondition(rule.condition, data);
        results.push({
          rule,
          applies,
          reason: applies 
            ? `Rule condition met: ${rule.condition}`
            : `Rule condition not met`
        });
      } catch (error) {
        results.push({
          rule,
          applies: false,
          reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }

    return results;
  }

  /**
   * Get applicable actions for data
   */
  async getApplicableActions(
    category: string,
    data: Record<string, unknown>
  ): Promise<string[]> {
    const evaluations = await this.evaluateRules(category, data);
    return evaluations
      .filter(e => e.applies)
      .map(e => e.rule.action);
  }

  // ===========================================
  // HELPERS
  // ===========================================

  private rowToRule(row: DomainRuleRow): DomainRule {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      description: row.description,
      condition: row.condition_expr,
      action: row.action_expr,
      priority: row.priority,
      isActive: row.is_active,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to || undefined
    };
  }

  private ruleToMemoryItem(rule: DomainRule): MemoryItem {
    return {
      id: rule.id,
      layer: 'domain',
      type: rule.category,
      content: `${rule.name}: ${rule.description}`,
      metadata: {
        source: 'domain_rules',
        tags: [rule.category, 'rule'],
        importance: rule.priority / 100,
        accessCount: 0,
        lastAccessedAt: new Date()
      },
      createdAt: rule.effectiveFrom,
      updatedAt: rule.effectiveFrom
    };
  }

  private extractKeywords(context: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
      'by', 'from', 'as', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
      'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until',
      'while', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
      'those', 'am', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it'
    ]);

    return context
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  private evaluateCondition(
    condition: string,
    data: Record<string, unknown>
  ): boolean {
    // Safe condition evaluation
    // In production, use a proper expression evaluator with sandboxing
    
    if (condition === 'true') return true;
    if (condition === 'false') return false;

    // Simple property checks
    const match = condition.match(/(\w+)\s*(===?|!==?|>=?|<=?)\s*(.+)/);
    if (match) {
      const [, prop, operator, value] = match;
      const dataValue = data[prop];
      const compareValue = this.parseValue(value);

      switch (operator) {
        case '==':
        case '===':
          return dataValue === compareValue;
        case '!=':
        case '!==':
          return dataValue !== compareValue;
        case '>':
          return Number(dataValue) > Number(compareValue);
        case '>=':
          return Number(dataValue) >= Number(compareValue);
        case '<':
          return Number(dataValue) < Number(compareValue);
        case '<=':
          return Number(dataValue) <= Number(compareValue);
      }
    }

    // Default to false for safety
    return false;
  }

  private parseValue(value: string): unknown {
    const trimmed = value.trim();
    
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }
    
    return trimmed;
  }
}






