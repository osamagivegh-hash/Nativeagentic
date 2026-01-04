import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bot,
  DollarSign,
  Shield,
  Users,
  Activity,
  Lightbulb,
  Wrench,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { getAgents, getTools, type AgentInfo, type ToolInfo } from '../api/client';

const agentIcons: Record<string, typeof Bot> = {
  financial: DollarSign,
  compliance: Shield,
  user_insight: Users,
  operations: Activity,
  strategy: Lightbulb
};

const agentColors: Record<string, { text: string; bg: string; border: string }> = {
  financial: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  compliance: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  user_insight: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  operations: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  strategy: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' }
};

export function Agents() {
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents
  });

  const toolsQuery = useQuery({
    queryKey: ['tools'],
    queryFn: getTools
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white">Agent Mesh</h1>
        <p className="text-white/50 mt-1">Specialized autonomous agents and their capabilities</p>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-2 gap-6">
        {agentsQuery.isLoading ? (
          <div className="col-span-2 glass-card p-12 text-center">
            <Bot className="w-8 h-8 text-nexus-400 mx-auto mb-3 animate-pulse" />
            <p className="text-white/60">Loading agents...</p>
          </div>
        ) : (
          agentsQuery.data?.agents.map((agent, i) => (
            <motion.div
              key={agent.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <AgentCard agent={agent} />
            </motion.div>
          ))
        )}
      </div>

      {/* Tools Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Wrench className="w-5 h-5 text-white/40" />
          <h2 className="text-xl font-display font-semibold text-white">Available Tools</h2>
          <span className="badge bg-surface-tertiary text-white/60">
            {toolsQuery.data?.tools.length || 0} tools
          </span>
        </div>

        {toolsQuery.isLoading ? (
          <div className="glass-card p-8 text-center">
            <Wrench className="w-6 h-6 text-nexus-400 mx-auto mb-3 animate-pulse" />
            <p className="text-white/60">Loading tools...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {toolsQuery.data?.tools.map((tool, i) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <ToolCard tool={tool} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentInfo }) {
  const Icon = agentIcons[agent.type] || Bot;
  const colors = agentColors[agent.type] || agentColors.operations;

  return (
    <div className={clsx(
      'glass-card overflow-hidden border',
      colors.border
    )}>
      {/* Header */}
      <div className={clsx('p-6', colors.bg)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              'bg-surface-primary/50 backdrop-blur'
            )}>
              <Icon className={clsx('w-6 h-6', colors.text)} />
            </div>
            <div>
              <h3 className="text-white font-display font-semibold">{agent.name}</h3>
              <span className="text-xs text-white/40 uppercase tracking-wider">{agent.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-status-success rounded-full animate-pulse" />
            <span className="text-xs text-white/40">Active</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-sm text-white/60 mb-6">{agent.description}</p>

        {/* Capabilities */}
        <div className="mb-6">
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            Capabilities
          </h4>
          <ul className="space-y-2">
            {agent.capabilities.slice(0, 4).map((cap) => (
              <li key={cap} className="flex items-center gap-2 text-sm text-white/70">
                <CheckCircle className={clsx('w-4 h-4', colors.text)} />
                {cap}
              </li>
            ))}
            {agent.capabilities.length > 4 && (
              <li className="text-xs text-white/40">
                +{agent.capabilities.length - 4} more capabilities
              </li>
            )}
          </ul>
        </div>

        {/* Tools */}
        <div>
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            Tools ({agent.tools.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {agent.tools.map((tool) => (
              <span
                key={tool}
                className="px-2 py-1 bg-surface-tertiary rounded-lg text-xs text-white/60"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolInfo }) {
  const riskColors = {
    read: { text: 'text-status-success', bg: 'bg-status-success/10' },
    write: { text: 'text-status-warning', bg: 'bg-status-warning/10' },
    destructive: { text: 'text-status-error', bg: 'bg-status-error/10' }
  };

  const colors = riskColors[tool.riskLevel as keyof typeof riskColors] || riskColors.read;

  return (
    <div className="glass-card p-4 hover:bg-surface-tertiary/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white">{tool.name}</span>
        </div>
        <span className={clsx(
          'px-2 py-0.5 rounded text-xs',
          colors.bg,
          colors.text
        )}>
          {tool.riskLevel}
        </span>
      </div>
      <p className="text-xs text-white/50 line-clamp-2">{tool.description}</p>
      <div className="mt-2">
        <span className="text-xs text-white/30">{tool.category}</span>
      </div>
    </div>
  );
}






