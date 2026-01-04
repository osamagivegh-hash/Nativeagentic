import fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { createClient } from 'redis';

const server = fastify({ logger: true });

// Environment Variables
const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.POSTGRES_CONNECTION_STRING;
const REDIS_URL = process.env.REDIS_CONNECTION_STRING;

// Database Connection
let pool: Pool;
let redisClient: any;

server.register(cors, { 
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
});

server.get('/health', async (request, reply) => {
    try {
        const dbRes = await pool.query('SELECT 1');
        const redisPing = await redisClient.ping();
        return { status: 'ok', db: 'connected', redis: redisPing };
    } catch (err: any) {
        server.log.error(err);
        return reply.status(500).send({ status: 'error', message: err.message });
    }
});

server.get('/', async (request, reply) => {
    return { message: 'AI-Native Agentic Application Backend is Running' };
});

const start = async () => {
    try {
        if (!DATABASE_URL) throw new Error('POSTGRES_CONNECTION_STRING not set');
        if (!REDIS_URL) throw new Error('REDIS_CONNECTION_STRING not set');

        pool = new Pool({ connectionString: DATABASE_URL });
        redisClient = createClient({ url: REDIS_URL });
        
        redisClient.on('error', (err: any) => server.log.error('Redis Client Error', err));
        await redisClient.connect();

        await server.listen({ port: Number(PORT), host: '0.0.0.0' });
        server.log.info(`Server listening on ${PORT}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
