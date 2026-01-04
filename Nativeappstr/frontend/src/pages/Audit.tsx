import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Filter,
  Brain,
  Clock,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import clsx from 'clsx';
import { getAuditLogs, getAIDecisions, type AuditLog, type AIDecision } from '../api/client';

export function Audit() {
  const [view, setView] = useState<'logs' | 'decisions'>('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => getAuditLogs({ limit: 100 }),
    enabled: view === 'logs'
  });

  const decisionsQuery = useQuery({
    queryKey: ['ai-decisions'],
    queryFn: () => getAIDecisions(50),
    enabled: view === 'decisions'
  });

  const filteredLogs = logsQuery.data?.logs.filter(log =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.resource.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredDecisions = decisionsQuery.data?.decisions.filter(d =>
    d.intent.normalizedQuery.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.intent.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Audit & Explainability</h1>
          <p className="text-white/50 mt-1">Complete audit trail and AI decision transparency</p>
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('logs')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              view === 'logs'
                ? 'bg-nexus-600/20 text-nexus-400 border border-nexus-500/30'
                : 'bg-surface-tertiary/50 text-white/60 hover:text-white border border-white/5'
            )}
          >
            <FileText className="w-4 h-4" />
            Audit Logs
          </button>
          <button
            onClick={() => setView('decisions')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              view === 'decisions'
                ? 'bg-nexus-600/20 text-nexus-400 border border-nexus-500/30'
                : 'bg-surface-tertiary/50 text-white/60 hover:text-white border border-white/5'
            )}
          >
            <Brain className="w-4 h-4" />
            AI Decisions
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="input-field pl-10 w-64"
          />
        </div>
      </div>

      {/* Content */}
      {view === 'logs' ? (
        <AuditLogsView
          logs={filteredLogs}
          isLoading={logsQuery.isLoading}
          expandedLog={expandedLog}
          setExpandedLog={setExpandedLog}
        />
      ) : (
        <AIDecisionsView
          decisions={filteredDecisions}
          isLoading={decisionsQuery.isLoading}
        />
      )}
    </div>
  );
}

function AuditLogsView({
  logs,
  isLoading,
  expandedLog,
  setExpandedLog
}: {
  logs: AuditLog[];
  isLoading: boolean;
  expandedLog: string | null;
  setExpandedLog: (id: string | null) => void;
}) {
  if (isLoading) {
    return (
      <div className="glass-card p-12 text-center">
        <Shield className="w-8 h-8 text-nexus-400 mx-auto mb-3 animate-pulse" />
        <p className="text-white/60">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Timestamp</th>
            <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Action</th>
            <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Resource</th>
            <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">User</th>
            <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <motion.tr
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="border-b border-white/5 hover:bg-surface-tertiary/30"
            >
              <td className="p-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Clock className="w-4 h-4 text-white/40" />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </td>
              <td className="p-4">
                <span className={clsx(
                  'badge',
                  log.action === 'ai_decision' ? 'badge-info' :
                  log.action === 'error' ? 'badge-error' : 'badge-success'
                )}>
                  {log.action}
                </span>
              </td>
              <td className="p-4 text-sm text-white">{log.resource}</td>
              <td className="p-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <User className="w-4 h-4 text-white/40" />
                  {log.userId?.slice(0, 8) || 'System'}
                </div>
              </td>
              <td className="p-4">
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="text-sm text-nexus-400 hover:text-nexus-300 flex items-center gap-1"
                >
                  {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  View
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      {/* Expanded Details */}
      {expandedLog && (
        <div className="p-6 border-t border-white/5 bg-surface-tertiary/30">
          <h4 className="text-sm font-medium text-white mb-3">Details</h4>
          <pre className="text-xs text-white/60 bg-surface-primary p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(logs.find(l => l.id === expandedLog)?.details || {}, null, 2)}
          </pre>
        </div>
      )}

      {logs.length === 0 && (
        <div className="p-12 text-center">
          <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">No audit logs found</p>
        </div>
      )}
    </div>
  );
}

function AIDecisionsView({
  decisions,
  isLoading
}: {
  decisions: AIDecision[];
  isLoading: boolean;
}) {
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="glass-card p-12 text-center">
        <Brain className="w-8 h-8 text-accent-purple mx-auto mb-3 animate-pulse" />
        <p className="text-white/60">Loading AI decisions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {decisions.map((decision, i) => (
        <motion.div
          key={decision.taskId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card overflow-hidden"
        >
          <div
            className="p-6 cursor-pointer hover:bg-surface-tertiary/30 transition-colors"
            onClick={() => setExpandedDecision(expandedDecision === decision.taskId ? null : decision.taskId)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="w-5 h-5 text-accent-purple" />
                  <span className="badge-info">{decision.intent.category}</span>
                  <span className="badge bg-surface-tertiary text-white/60">
                    {decision.plan.complexity}
                  </span>
                </div>
                <p className="text-white font-medium">{decision.intent.normalizedQuery}</p>
                <p className="text-sm text-white/50 mt-1">{decision.explanation.summary}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-medium text-white">
                    {Math.round(decision.explanation.confidence * 100)}%
                  </p>
                  <p className="text-xs text-white/40">confidence</p>
                </div>
                {expandedDecision === decision.taskId ? (
                  <ChevronUp className="w-5 h-5 text-white/40" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/40" />
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Activity className="w-4 h-4 text-white/40" />
                {decision.execution.totalDuration}ms
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Brain className="w-4 h-4 text-white/40" />
                {decision.execution.agentsInvolved.join(', ')}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedDecision === decision.taskId && (
            <div className="px-6 pb-6 border-t border-white/5">
              <div className="grid grid-cols-2 gap-6 mt-6">
                {/* Execution Details */}
                <div>
                  <h4 className="text-sm font-medium text-white mb-3">Execution Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Status</span>
                      <span className={clsx(
                        'badge',
                        decision.execution.status === 'completed' ? 'badge-success' : 'badge-warning'
                      )}>
                        {decision.execution.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Duration</span>
                      <span className="text-white">{decision.execution.totalDuration}ms</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Tokens Used</span>
                      <span className="text-white">{decision.execution.totalTokens}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium text-white mt-6 mb-3">Tools Used</h4>
                  <div className="flex flex-wrap gap-2">
                    {decision.execution.toolsUsed.map((tool) => (
                      <span key={tool} className="px-2 py-1 bg-surface-tertiary rounded text-xs text-white/60">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Reasoning */}
                <div>
                  <h4 className="text-sm font-medium text-white mb-3">AI Reasoning</h4>
                  <p className="text-sm text-white/60">{decision.explanation.reasoning}</p>

                  <h4 className="text-sm font-medium text-white mt-6 mb-3">Plan Steps</h4>
                  <div className="space-y-2">
                    {decision.plan.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-surface-tertiary flex items-center justify-center text-xs text-white/60">
                          {i + 1}
                        </span>
                        <span className="text-white/60">{step.action}</span>
                        <span className="text-xs text-white/40">({step.agentType})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      ))}

      {decisions.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Brain className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">No AI decisions found</p>
        </div>
      )}
    </div>
  );
}






