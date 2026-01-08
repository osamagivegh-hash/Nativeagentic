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
    console.error('DATABASE_URL or POSTGRES_CONNECTION_STRING is not defined');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    const client = await pool.connect();

    try {
        logger.info('Starting database seed...');
        await client.query('BEGIN');

        // 1. Create Default Admin User
        logger.info('Seeding users...');
        const adminId = uuidv4();
        await client.query(`
      INSERT INTO users (id, email, name, role, password_hash, permissions)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
            adminId,
            'admin@nexus.ai',
            'System Administrator',
            'admin',
            '$2b$10$X7.X7.X7.X7.X7.X7.X7.X7', // Mock hash
            JSON.stringify(['*'])
        ]);

        // 2. Clear existing business data
        await client.query('TRUNCATE TABLE financial_transactions, metrics, domain_rules, audit_logs CASCADE');

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
        INSERT INTO financial_transactions (user_id, type, category, amount, description, transaction_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
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
          INSERT INTO metrics (name, value, unit, recorded_at)
          VALUES ($1, $2, $3, $4)
        `, [
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
      INSERT INTO domain_rules (category, name, description, condition_expr, action_expr, is_active)
      VALUES 
      ('finance', 'Max Transaction Limit check', 'Flag transactions over $10,000 for review', 'transaction.amount > 10000', 'flag_for_review', true),
      ('privacy', 'GDPR Data Retention', 'Ensure user data is deleted after 3 years of inactivity', 'user.last_login > 3_years', 'delete_user_data', true),
      ('security', 'API Rate Limit', 'Block IPs exceeding 100 req/min', 'requests_per_min > 100', 'block_ip', true)
    `);

        // 6. Seed Audit Logs (User Behavior Agent)
        logger.info('Seeding audit logs...');
        const actions = ['login', 'view_dashboard', 'generate_report', 'update_settings', 'export_data'];
        for (let i = 0; i < 20; i++) {
            const date = new Date();
            date.setHours(date.getHours() - Math.floor(Math.random() * 48));

            await client.query(`
          INSERT INTO audit_logs (user_id, action, resource, details, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [
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
        await pool.end();
    }
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
