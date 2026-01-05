// ===========================================
// NEXUS AI PLATFORM - CONFIGURATION
// ===========================================

import { z } from 'zod';

const ConfigSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  host: z.string().default('0.0.0.0'),

  // Database
  databaseUrl: z.string(),
  databasePoolMin: z.coerce.number().default(2),
  databasePoolMax: z.coerce.number().default(10),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  redisPrefix: z.string().default('nexus:'),

  // Vector DB
  vectorDimensions: z.coerce.number().default(1536),

  // OpenAI
  openaiApiKey: z.string(),
  openaiBaseUrl: z.string().default('https://api.openai.com/v1'),
  openaiModel: z.string().default('gpt-4-turbo-preview'),
  openaiEmbeddingModel: z.string().default('text-embedding-3-small'),

  // Security
  jwtSecret: z.string(),
  jwtExpiresIn: z.string().default('24h'),
  encryptionKey: z.string(),

  // Rate Limiting
  rateLimitMax: z.coerce.number().default(100),
  rateLimitWindowMs: z.coerce.number().default(60000),

  // Logging
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  logPretty: z.coerce.boolean().default(true),

  // AI Orchestrator
  orchestratorMaxRetries: z.coerce.number().default(3),
  orchestratorConfidenceThreshold: z.coerce.number().default(0.7),
  orchestratorTimeoutMs: z.coerce.number().default(30000),

  // Agent
  agentMaxToolCalls: z.coerce.number().default(10),
  agentParallelExecution: z.coerce.boolean().default(true),

  // Proactive Intelligence
  proactiveEnabled: z.coerce.boolean().default(true),
  proactiveScanIntervalMs: z.coerce.number().default(300000),
  anomalyThreshold: z.coerce.number().default(2.5),

  // Audit
  auditEnabled: z.coerce.boolean().default(true),
  auditRetentionDays: z.coerce.number().default(90)
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const envMapping = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING,
    databasePoolMin: process.env.DATABASE_POOL_MIN,
    databasePoolMax: process.env.DATABASE_POOL_MAX,
    redisUrl: process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING,
    redisPrefix: process.env.REDIS_PREFIX,
    vectorDimensions: process.env.VECTOR_DIMENSIONS,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    encryptionKey: process.env.ENCRYPTION_KEY,
    rateLimitMax: process.env.RATE_LIMIT_MAX,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    logLevel: process.env.LOG_LEVEL,
    logPretty: process.env.LOG_PRETTY,
    orchestratorMaxRetries: process.env.ORCHESTRATOR_MAX_RETRIES,
    orchestratorConfidenceThreshold: process.env.ORCHESTRATOR_CONFIDENCE_THRESHOLD,
    orchestratorTimeoutMs: process.env.ORCHESTRATOR_TIMEOUT_MS,
    agentMaxToolCalls: process.env.AGENT_MAX_TOOL_CALLS,
    agentParallelExecution: process.env.AGENT_PARALLEL_EXECUTION,
    proactiveEnabled: process.env.PROACTIVE_ENABLED,
    proactiveScanIntervalMs: process.env.PROACTIVE_SCAN_INTERVAL_MS,
    anomalyThreshold: process.env.ANOMALY_THRESHOLD,
    auditEnabled: process.env.AUDIT_ENABLED,
    auditRetentionDays: process.env.AUDIT_RETENTION_DAYS
  };

  // Filter out undefined values
  const filtered = Object.fromEntries(
    Object.entries(envMapping).filter(([_, v]) => v !== undefined)
  );

  const result = ConfigSchema.safeParse(filtered);

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration. Check environment variables.');
  }

  return result.data;
}

export const config = loadConfig();

// Export individual config sections for convenience
export const serverConfig = {
  nodeEnv: config.nodeEnv,
  port: config.port,
  host: config.host
};

export const databaseConfig = {
  url: config.databaseUrl,
  poolMin: config.databasePoolMin,
  poolMax: config.databasePoolMax
};

export const redisConfig = {
  url: config.redisUrl,
  prefix: config.redisPrefix
};

export const aiConfig = {
  apiKey: config.openaiApiKey,
  baseUrl: config.openaiBaseUrl,
  model: config.openaiModel,
  embeddingModel: config.openaiEmbeddingModel
};

export const orchestratorConfig = {
  maxRetries: config.orchestratorMaxRetries,
  confidenceThreshold: config.orchestratorConfidenceThreshold,
  timeoutMs: config.orchestratorTimeoutMs
};

export const agentConfig = {
  maxToolCalls: config.agentMaxToolCalls,
  parallelExecution: config.agentParallelExecution
};






