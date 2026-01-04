// ===========================================
// NEXUS AI PLATFORM - DATABASE CONNECTION
// ===========================================

import { Pool, PoolClient, QueryResult } from 'pg';
import { databaseConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { JSONValue, UUID } from '../types/index.js';

// Create connection pool
export const pool = new Pool({
  connectionString: databaseConfig.url,
  min: databaseConfig.poolMin,
  max: databaseConfig.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Pool event handlers
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

// Query wrapper with logging
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text, duration, rows: result.rowCount }, 'Query executed');
    return result;
  } catch (error) {
    logger.error({ query: text, error }, 'Query failed');
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Generic CRUD helpers
export const db = {
  async findOne<T>(
    table: string,
    where: Record<string, unknown>,
    columns = '*'
  ): Promise<T | null> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    
    const result = await query<T>(
      `SELECT ${columns} FROM ${table} WHERE ${whereClause} LIMIT 1`,
      values
    );
    return result.rows[0] || null;
  },

  async findMany<T>(
    table: string,
    where: Record<string, unknown> = {},
    options: {
      columns?: string;
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    const { columns = '*', orderBy, limit, offset } = options;
    const keys = Object.keys(where);
    const values = Object.values(where);
    
    let sql = `SELECT ${columns} FROM ${table}`;
    
    if (keys.length > 0) {
      const whereClause = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    if (offset) sql += ` OFFSET ${offset}`;
    
    const result = await query<T>(sql, values);
    return result.rows;
  },

  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    returning = '*'
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await query<T>(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING ${returning}`,
      values
    );
    return result.rows[0];
  },

  async update<T>(
    table: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
    returning = '*'
  ): Promise<T | null> {
    const whereKeys = Object.keys(where);
    const dataKeys = Object.keys(data);
    const allValues = [...Object.values(data), ...Object.values(where)];
    
    const setClause = dataKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const whereClause = whereKeys
      .map((k, i) => `${k} = $${dataKeys.length + i + 1}`)
      .join(' AND ');
    
    const result = await query<T>(
      `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING ${returning}`,
      allValues
    );
    return result.rows[0] || null;
  },

  async delete(
    table: string,
    where: Record<string, unknown>
  ): Promise<number> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    
    const result = await query(
      `DELETE FROM ${table} WHERE ${whereClause}`,
      values
    );
    return result.rowCount || 0;
  },

  async count(
    table: string,
    where: Record<string, unknown> = {}
  ): Promise<number> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    
    if (keys.length > 0) {
      const whereClause = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
    }
    
    const result = await query<{ count: string }>(sql, values);
    return parseInt(result.rows[0].count, 10);
  },

  // Vector similarity search
  async vectorSearch<T>(
    table: string,
    embeddingColumn: string,
    embedding: number[],
    options: {
      columns?: string;
      where?: Record<string, unknown>;
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<(T & { similarity: number })[]> {
    const { columns = '*', where = {}, limit = 10, minSimilarity = 0.5 } = options;
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);
    
    const embeddingStr = `[${embedding.join(',')}]`;
    let paramIndex = 1;
    
    let sql = `
      SELECT ${columns}, 
             1 - (${embeddingColumn} <=> $${paramIndex}::vector) as similarity
      FROM ${table}
      WHERE 1 - (${embeddingColumn} <=> $${paramIndex}::vector) >= $${paramIndex + 1}
    `;
    
    const params: unknown[] = [embeddingStr, minSimilarity];
    paramIndex = 3;
    
    if (whereKeys.length > 0) {
      const whereClause = whereKeys.map((k) => {
        params.push(whereValues[paramIndex - 3]);
        return `${k} = $${paramIndex++}`;
      }).join(' AND ');
      sql += ` AND ${whereClause}`;
    }
    
    sql += ` ORDER BY similarity DESC LIMIT ${limit}`;
    
    const result = await query<T & { similarity: number }>(sql, params);
    return result.rows;
  }
};

// Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}






