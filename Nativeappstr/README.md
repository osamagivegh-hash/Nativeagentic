# 🚀 Nexus AI Platform

> **AI-Native Agentic Operating System** - A production-ready platform where AI is the decision-maker, not just a chatbot wrapper.

<div align="center">

![Nexus AI Platform](https://via.placeholder.com/800x400/0a0a0f/5c7cfa?text=NEXUS+AI+PLATFORM)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192.svg)](https://www.postgresql.org/)

</div>

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Agent System](#agent-system)
- [Memory System](#memory-system)
- [Proactive Intelligence](#proactive-intelligence)
- [Security & Governance](#security--governance)
- [Deployment](#deployment)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  React Dashboard │ Natural Language Input │ Insights Panel │ Audit Viewer  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY LAYER                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Auth/RBAC   │ │ Rate Limit  │ │ Validation  │ │ Audit Log   │               │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AI ORCHESTRATOR (CORE BRAIN)                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ Intent Parser → Task Planner → Agent Router → Execution Manager → Validator ││
│  │                              ↓                                              ││
│  │                    Explanation Generator                                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT MESH LAYER                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│  │ Financial  │ │ Compliance │ │  User      │ │ Operations │ │ Strategy   │     │
│  │ Agent      │ │ Agent      │ │ Insight    │ │ Agent      │ │ Agent      │     │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘     │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              MEMORY SYSTEM                                       │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │ Short-Term     │ │ User Memory    │ │ Domain Memory  │ │ Operational    │    │
│  │ (Redis)        │ │ (Vector DB)    │ │ (PostgreSQL)   │ │ (PostgreSQL)   │    │
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Components

### 1. AI Orchestrator (`/backend/src/orchestrator/`)
The **central brain** of the system that:
- Parses user intent using LLM
- Creates execution plans
- Routes tasks to appropriate agents
- Validates results
- Generates human-readable explanations

### 2. Agent Mesh (`/backend/src/agents/`)
Five specialized autonomous agents:

| Agent | Purpose | Key Capabilities |
|-------|---------|------------------|
| **Financial** | Financial analysis & forecasting | Transaction analysis, metrics calculation, reporting |
| **Compliance** | Regulatory compliance | Rule validation, risk assessment, audit support |
| **User Insight** | User behavior analysis | Segmentation, churn prediction, personalization |
| **Operations** | System health & ops | Monitoring, alerting, performance analysis |
| **Strategy** | Strategic recommendations | Opportunity detection, planning, decision support |

### 3. Tool System (`/backend/src/tools/`)
Sandboxed tools that agents can use:
- **Database Tools**: Query financial data, users, metrics, rules
- **Calculation Tools**: Metrics, forecasting, trend analysis
- **Report Tools**: Generate reports, compliance assessments
- **Workflow Tools**: Execute operations, manage alerts
- **Analysis Tools**: Data analysis, behavior patterns, risk assessment

### 4. Memory System (`/backend/src/memory/`)
Four-layer memory architecture:

| Layer | Storage | Purpose | TTL |
|-------|---------|---------|-----|
| **Short-Term** | Redis | Session/conversation context | 2 hours |
| **User** | pgvector | User preferences & behavior | Permanent |
| **Domain** | PostgreSQL | Business rules & regulations | Permanent |
| **Operational** | pgvector | System learnings & patterns | Pruned |

### 5. Proactive Intelligence (`/backend/src/services/proactive-intelligence.ts`)
AI-driven background service that:
- Detects anomalies in real-time
- Identifies business opportunities
- Analyzes trends
- Assesses risks
- Generates actionable insights

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (with pgvector extension)
- Redis 7+
- OpenAI API key (or compatible LLM API)

### Installation

1. **Clone the repository**
```bash
cd Nativeappstr
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
# Copy environment template
cp backend/env.example backend/.env

# Edit with your values
# - DATABASE_URL
# - REDIS_URL
# - OPENAI_API_KEY
# - JWT_SECRET
# etc.
```

4. **Setup database**
```bash
# Run migrations
npm run db:migrate --workspace=backend

# Optional: Seed sample data
npm run db:seed --workspace=backend
```

5. **Start development servers**
```bash
npm run dev
```

This starts:
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000

---

## 📡 API Documentation

### Chat Endpoint
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Analyze our financial transactions from the past month",
  "conversationId": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "uuid",
    "response": "Analysis complete...",
    "status": "completed",
    "explanation": {
      "summary": "Analyzed 1,234 transactions...",
      "reasoning": "Used financial agent to...",
      "confidence": 0.92,
      "dataSources": ["financial_transactions"],
      "limitations": []
    },
    "metadata": {
      "duration": 2340,
      "agentsUsed": ["financial", "strategy"],
      "confidenceScores": [0.95, 0.88]
    }
  }
}
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to AI orchestrator |
| `GET` | `/api/insights` | Get proactive insights |
| `POST` | `/api/insights/:id/acknowledge` | Acknowledge an insight |
| `GET` | `/api/audit` | Get audit logs |
| `GET` | `/api/audit/decisions` | Get AI decision logs |
| `GET` | `/api/agents` | List available agents |
| `GET` | `/api/tools` | List available tools |
| `GET` | `/api/dashboard` | Get dashboard data |

---

## 🤖 Agent System

### Agent Configuration
Each agent is configured with:
```typescript
interface AgentConfig {
  type: AgentType;           // Agent identifier
  name: string;              // Display name
  description: string;       // Purpose description
  capabilities: string[];    // What it can do
  tools: string[];          // Available tools
  maxToolCalls: number;      // Safety limit
  timeout: number;           // Execution timeout
  confidenceThreshold: number; // Minimum confidence
}
```

### Agent Execution Flow
```
1. Receive instruction from Orchestrator
2. Build context from Memory System
3. Enter ReAct loop:
   a. Think: Analyze current state
   b. Act: Call tool if needed
   c. Observe: Process tool result
   d. Repeat until done
4. Return structured result with:
   - Output data
   - Tool executions log
   - Reasoning chain
   - Confidence score
```

---

## 🧠 Memory System

### Memory Retrieval Strategy
```typescript
// Search across all memory layers
const memories = await memoryManager.searchAll(
  "user financial preferences",
  { userId, sessionId, limit: 10, minRelevance: 0.7 }
);

// Results organized by layer
memories.get('short_term')  // Recent conversation
memories.get('user')        // User preferences
memories.get('domain')      // Business rules
memories.get('operational') // System learnings
```

### Memory Consolidation
Short-term memories are periodically consolidated:
1. Group by type
2. Summarize using LLM
3. Store in user memory with embeddings
4. Clean up short-term storage

---

## 🔮 Proactive Intelligence

The system proactively monitors and generates insights:

### Insight Types
| Type | Description | Example |
|------|-------------|---------|
| `anomaly` | Unusual patterns detected | Transaction 3σ above mean |
| `opportunity` | Potential improvements | Cost concentration in category |
| `trend` | Significant patterns | Revenue growth trajectory |
| `risk` | Potential issues | Compliance gaps |
| `optimization` | Efficiency improvements | Inactive user re-engagement |

### Configuration
```env
PROACTIVE_ENABLED=true
PROACTIVE_SCAN_INTERVAL_MS=300000  # 5 minutes
ANOMALY_THRESHOLD=2.5              # Standard deviations
```

---

## 🔐 Security & Governance

### Role-Based Access Control
```typescript
type UserRole = 'admin' | 'analyst' | 'operator' | 'viewer';

// Permission examples
const permissions = [
  'read_financial_data',
  'execute_operations',
  'manage_alerts',
  'high_risk_operations'  // Admin only
];
```

### AI Action Safety
- **No silent destructive actions**: All writes require explicit approval
- **Risk assessment**: Every task plan includes risk evaluation
- **Approval workflow**: High-risk tasks require human approval
- **Full audit trail**: Every AI decision is logged with explanation

### Audit Trail
Every action is logged with:
- User ID & Session ID
- Action type & resource
- Full request/response details
- AI decision reasoning (for AI actions)
- Timestamp & duration

---

## 🚢 Deployment

### Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    ports:
      - "3001:3001"
    
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    
  postgres:
    image: pgvector/pgvector:pg16
    
  redis:
    image: redis:7-alpine
```

### Environment Variables
```env
# Production settings
NODE_ENV=production
LOG_LEVEL=info
LOG_PRETTY=false

# Security
JWT_SECRET=<strong-secret-key>
ENCRYPTION_KEY=<32-char-key>

# Performance
DATABASE_POOL_MAX=20
RATE_LIMIT_MAX=1000
ORCHESTRATOR_TIMEOUT_MS=60000
```

### Scaling Considerations
- **Horizontal scaling**: API is stateless, scale behind load balancer
- **Database**: Use read replicas for queries
- **Redis**: Cluster mode for high availability
- **Background jobs**: Use Bull/BullMQ for job distribution
- **Vector search**: Consider dedicated vector DB at scale (Pinecone, Weaviate)

---

## 📁 Project Structure

```
Nativeappstr/
├── backend/
│   └── src/
│       ├── agents/           # Specialized AI agents
│       │   ├── base-agent.ts
│       │   ├── registry.ts
│       │   ├── financial-agent.ts
│       │   ├── compliance-agent.ts
│       │   ├── user-insight-agent.ts
│       │   ├── operations-agent.ts
│       │   └── strategy-agent.ts
│       ├── ai/               # LLM integration
│       │   └── llm-provider.ts
│       ├── config/           # Configuration
│       ├── database/         # DB connection & schema
│       ├── memory/           # Multi-layer memory
│       │   ├── manager.ts
│       │   ├── short-term.ts
│       │   ├── user-memory.ts
│       │   ├── domain-memory.ts
│       │   └── operational-memory.ts
│       ├── orchestrator/     # AI orchestration
│       │   └── index.ts
│       ├── routes/           # API endpoints
│       ├── services/         # Business services
│       │   ├── audit.ts
│       │   └── proactive-intelligence.ts
│       ├── tools/            # Agent tools
│       │   ├── registry.ts
│       │   ├── database-tools.ts
│       │   ├── calculation-tools.ts
│       │   ├── report-tools.ts
│       │   ├── workflow-tools.ts
│       │   └── analysis-tools.ts
│       ├── types/            # TypeScript types
│       └── utils/            # Utilities
│
├── frontend/
│   └── src/
│       ├── api/              # API client
│       ├── components/       # React components
│       │   └── Layout.tsx
│       └── pages/            # Page components
│           ├── Dashboard.tsx
│           ├── Chat.tsx
│           ├── Insights.tsx
│           ├── Audit.tsx
│           └── Agents.tsx
│
└── package.json              # Workspace root
```

---

## 🛠️ Development

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Database Migrations
```bash
# Run migrations
npm run db:migrate --workspace=backend

# Create new migration
# Add SQL to backend/src/database/migrations/
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the AI-Native future**

[Report Bug](https://github.com/your-repo/issues) · [Request Feature](https://github.com/your-repo/issues)

</div>






