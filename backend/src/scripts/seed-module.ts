import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
    // Try to use config if env var not set directly (for API call context)
    if (!config.databaseUrl) {
        logger.error('DATABASE_URL or POSTGRES_CONNECTION_STRING is not defined');
        throw new Error('Database connection string missing');
    }
}

const pool = new Pool({
    connectionString: connectionString || config.databaseUrl,
    ssl: { rejectUnauthorized: false }
});

export async function seed() {
    const client = await pool.connect();

    try {
        logger.info('Starting database seed...');
        await client.query('BEGIN');

        // Create schema if not exists
        // Note: extensions like uuid-ossp might require superuser. 
        // We will generate UUIDs in the app layer to avoid dependency on DB extensions.

        await client.query('CREATE EXTENSION IF NOT EXISTS "vector"'); // vector usually allowed

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'viewer',
                permissions JSONB DEFAULT '[]'::jsonb,
                preferences JSONB DEFAULT '{}'::jsonb,
                is_active BOOLEAN DEFAULT true,
                last_login_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add user_memories table for AI memory context
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_memories (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                embedding vector(1536),
                metadata JSONB DEFAULT '{}'::jsonb,
                importance DECIMAL(3,2) DEFAULT 0.5,
                access_count INTEGER DEFAULT 0,
                last_accessed_at TIMESTAMP WITH TIME ZONE,
                expires_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add conversations table for chat history
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255),
                context JSONB DEFAULT '{}'::jsonb,
                is_archived BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY,
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add tasks table (required by operational_learnings foreign key)
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add operational_learnings table for AI memory
        await client.query(`
            CREATE TABLE IF NOT EXISTS operational_learnings (
                id UUID PRIMARY KEY,
                type VARCHAR(100) NOT NULL,
                context TEXT NOT NULL,
                learning TEXT NOT NULL,
                embedding vector(1536),
                confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5,
                source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
                applied_count INTEGER DEFAULT 0,
                success_rate DECIMAL(5,4),
                is_validated BOOLEAN DEFAULT false,
                validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS financial_transactions (
                id UUID PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                type VARCHAR(50) NOT NULL,
                category VARCHAR(100),
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                description TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS metrics (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                value DECIMAL(20,4) NOT NULL,
                unit VARCHAR(50),
                dimensions JSONB DEFAULT '{}'::jsonb,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS domain_rules (
                id UUID PRIMARY KEY,
                category VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                condition_expr TEXT NOT NULL,
                action_expr TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                effective_to TIMESTAMP WITH TIME ZONE,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                session_id UUID,
                action VARCHAR(255) NOT NULL,
                resource VARCHAR(255) NOT NULL,
                resource_id UUID,
                details JSONB DEFAULT '{}'::jsonb,
                ai_decision JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 1. Create Default Admin User or get existing
        logger.info('Seeding users...');
        let adminId: string;

        // First check if admin exists
        const existingAdmin = await client.query(`
            SELECT id FROM users WHERE email = 'admin@nexus.ai'
        `);

        if (existingAdmin.rows.length > 0) {
            adminId = existingAdmin.rows[0].id;
            logger.info('Using existing admin user');
        } else {
            adminId = uuidv4();
            await client.query(`
                INSERT INTO users (id, email, name, role, password_hash, permissions)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                adminId,
                'admin@nexus.ai',
                'System Administrator',
                'admin',
                '$2b$10$X7.X7.X7.X7.X7.X7.X7.X7', // Mock hash
                JSON.stringify(['*'])
            ]);
            logger.info('Created new admin user');
        }

        // Also create/update demo user for the frontend
        const demoUserId = '00000000-0000-0000-0000-000000000001';
        const existingDemo = await client.query(`
            SELECT id FROM users WHERE id = $1
        `, [demoUserId]);

        if (existingDemo.rows.length === 0) {
            await client.query(`
                INSERT INTO users (id, email, name, role, password_hash, permissions)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                demoUserId,
                'demo@nexus.ai',
                'Demo User',
                'analyst',
                '$2b$10$X7.X7.X7.X7.X7.X7.X7.X7', // Mock hash
                JSON.stringify(['read_financial_data', 'read_user_data', 'read_metrics', 'read_rules', 'read_compliance', 'analyze_data', 'analyze_users', 'assess_risk', 'check_compliance', 'generate_reports', 'manage_alerts', 'execute_operations', 'read_system_health'])
            ]);
            logger.info('Created demo user');
        }

        // 2. Clear existing business data (not users)
        await client.query('DELETE FROM financial_transactions');
        await client.query('DELETE FROM metrics');
        await client.query('DELETE FROM domain_rules');
        await client.query('DELETE FROM audit_logs');
        await client.query('DELETE FROM user_memories WHERE user_id = $1', [adminId]);

        // 3. Seed Financial Transactions (Revenue & Expenses for Financial Agent)
        logger.info('Seeding financial transactions...');
        const categories = ['Software Subscription', 'Cloud Infrastructure', 'Office Supplies', 'Marketing', 'Consulting'];
        const types = ['expense', 'income'];

        for (let i = 0; i < 50; i++) {
            const type = i % 5 === 0 ? 'income' : 'expense';
            const amount = type === 'income' ? Math.random() * 50000 + 10000 : Math.random() * 5000 + 100;
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));

            await client.query(`
        INSERT INTO financial_transactions (id, user_id, type, category, amount, description, transaction_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                uuidv4(),
                adminId,
                type,
                categories[Math.floor(Math.random() * categories.length)],
                amount.toFixed(2),
                `${type === 'income' ? 'Client Payment' : 'Purchase'} #${i + 1000}`,
                date
            ]);
        }

        // 4. Seed Metrics (System Health for Operations Agent)
        logger.info('Seeding metrics...');
        const metricNames = ['cpu_usage', 'memory_usage', 'api_latency', 'active_users'];
        for (let i = 0; i < 7 * 24; i++) { // 7 days of hourly data
            const date = new Date();
            date.setHours(date.getHours() - i);

            for (const name of metricNames) {
                let value = 0;
                if (name === 'cpu_usage') value = 30 + Math.random() * 40; // 30-70%
                if (name === 'memory_usage') value = 4096 + Math.random() * 2048; // 4-6GB
                if (name === 'api_latency') value = 50 + Math.random() * 100; // 50-150ms
                if (name === 'active_users') value = 100 + Math.random() * 50; // 100-150 users

                await client.query(`
          INSERT INTO metrics (id, name, value, unit, recorded_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [
                    uuidv4(),
                    name,
                    value.toFixed(2),
                    name.includes('usage') && name !== 'memory_usage' ? '%' : name === 'memory_usage' ? 'MB' : name === 'api_latency' ? 'ms' : 'count',
                    date
                ]);
            }
        }

        // 5. Seed Domain Rules (Compliance Agent)
        logger.info('Seeding domain rules...');
        await client.query(`
      INSERT INTO domain_rules (id, category, name, description, condition_expr, action_expr, is_active)
      VALUES 
      ('${uuidv4()}', 'finance', 'Max Transaction Limit check', 'Flag transactions over $10,000 for review', 'transaction.amount > 10000', 'flag_for_review', true),
      ('${uuidv4()}', 'privacy', 'GDPR Data Retention', 'Ensure user data is deleted after 3 years of inactivity', 'user.last_login > 3_years', 'delete_user_data', true),
      ('${uuidv4()}', 'security', 'API Rate Limit', 'Block IPs exceeding 100 req/min', 'requests_per_min > 100', 'block_ip', true)
    `);

        // 6. Seed Audit Logs (User Behavior Agent)
        logger.info('Seeding audit logs...');
        const actions = ['login', 'view_dashboard', 'generate_report', 'update_settings', 'export_data'];
        for (let i = 0; i < 20; i++) {
            const date = new Date();
            date.setHours(date.getHours() - Math.floor(Math.random() * 48));

            await client.query(`
          INSERT INTO audit_logs (id, user_id, action, resource, details, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                uuidv4(),
                adminId,
                actions[Math.floor(Math.random() * actions.length)],
                'system',
                JSON.stringify({ ip: '192.168.1.1', userAgent: 'Mozilla/5.0' }),
                date
            ]);
        }

        await client.query('COMMIT');
        logger.info('Database seeding completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error }, 'Error seeding database');
        throw error;
    } finally {
        client.release();
    }
}
