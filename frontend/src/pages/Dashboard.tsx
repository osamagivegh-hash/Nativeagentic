import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Brain,
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { getDashboard, type ProactiveInsight } from '../api/client';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-white/60">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-status-error mx-auto mb-3" />
        <p className="text-white/60">Failed to load dashboard</p>
      </div>
    );
  }

  const stats = [
    {
      label: 'AI Decisions',
      value: data?.stats.aiDecisions || 0,
      icon: Brain,
      color: 'text-nexus-400',
      bgColor: 'bg-nexus-500/10'
    },
    {
      label: 'Total Actions',
      value: data?.stats.totalActions || 0,
      icon: Zap,
      color: 'text-accent-cyan',
      bgColor: 'bg-accent-cyan/10'
    },
    {
      label: 'Active Insights',
      value: data?.insights.length || 0,
      icon: TrendingUp,
      color: 'text-accent-purple',
      bgColor: 'bg-accent-purple/10'
    },
    {
      label: 'System Errors',
      value: data?.stats.errors || 0,
      icon: AlertTriangle,
      color: (data?.stats.errors ?? 0) > 0 ? 'text-status-error' : 'text-status-success',
      bgColor: (data?.stats.errors ?? 0) > 0 ? 'bg-status-error/10' : 'bg-status-success/10'
    }
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-white/50 mt-1">AI-powered insights and system overview</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            className="stat-card"
          >
            <div className="flex items-center justify-between">
              <div className={clsx('p-2 rounded-lg', stat.bgColor)}>
                <stat.icon className={clsx('w-5 h-5', stat.color)} />
              </div>
              <span className="text-xs text-white/40">7 days</span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-display font-bold text-white">
                {stat.value.toLocaleString()}
              </p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Proactive Insights */}
        <motion.div variants={itemVariants} className="col-span-2">
          <div className="glass-card">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-nexus-400" />
                <h2 className="font-display font-semibold text-white">Proactive Insights</h2>
              </div>
              <span className="text-xs text-white/40">AI-generated</span>
            </div>
            <div className="p-6 space-y-4">
              {data?.insights.slice(0, 4).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
              {(!data?.insights || data.insights.length === 0) && (
                <div className="text-center py-8 text-white/40">
                  <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No active insights</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent AI Decisions */}
        <motion.div variants={itemVariants}>
          <div className="glass-card h-full">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
              <Brain className="w-5 h-5 text-accent-purple" />
              <h2 className="font-display font-semibold text-white">Recent Decisions</h2>
            </div>
            <div className="p-4 space-y-3">
              {data?.recentDecisions.slice(0, 5).map((decision) => (
                <div
                  key={decision.taskId}
                  className="p-4 bg-surface-tertiary/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{decision.intent}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={clsx(
                          'badge',
                          decision.status === 'completed' ? 'badge-success' : 'badge-warning'
                        )}>
                          {decision.status}
                        </span>
                        <span className="text-xs text-white/40">
                          {Math.round(decision.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <CheckCircle className={clsx(
                      'w-4 h-4 flex-shrink-0',
                      decision.status === 'completed' ? 'text-status-success' : 'text-status-warning'
                    )} />
                  </div>
                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    {decision.agents.map((agent) => (
                      <span
                        key={agent}
                        className="px-2 py-0.5 bg-surface-elevated rounded text-xs text-white/60"
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {(!data?.recentDecisions || data.recentDecisions.length === 0) && (
                <div className="text-center py-8 text-white/40">
                  <Brain className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No recent decisions</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Activity Chart Placeholder */}
      <motion.div variants={itemVariants} className="glass-card">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <Activity className="w-5 h-5 text-accent-cyan" />
          <h2 className="font-display font-semibold text-white">System Activity</h2>
        </div>
        <div className="p-6 h-64 flex items-center justify-center">
          <div className="text-center text-white/40">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Activity visualization would appear here</p>
            <p className="text-sm mt-1">Real-time charts powered by Recharts</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InsightCard({ insight }: { insight: ProactiveInsight }) {
  const severityConfig = {
    info: { icon: TrendingUp, color: 'text-status-info', bg: 'bg-status-info/10', border: 'border-status-info/30' },
    warning: { icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/30' },
    critical: { icon: AlertTriangle, color: 'text-status-error', bg: 'bg-status-error/10', border: 'border-status-error/30' }
  };

  const config = severityConfig[insight.severity];
  const Icon = config.icon;

  const typeLabels: Record<string, string> = {
    anomaly: 'Anomaly Detected',
    opportunity: 'Opportunity',
    trend: 'Trend Analysis',
    risk: 'Risk Alert',
    optimization: 'Optimization'
  };

  return (
    <div className={clsx(
      'p-4 rounded-xl border transition-all duration-200 hover:bg-surface-tertiary/50',
      config.bg,
      config.border
    )}>
      <div className="flex items-start gap-4">
        <div className={clsx('p-2 rounded-lg', config.bg)}>
          <Icon className={clsx('w-5 h-5', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              {typeLabels[insight.type] || insight.type}
            </span>
            <span className="text-xs text-white/30">
              {Math.round(insight.confidence * 100)}% confidence
            </span>
          </div>
          <h3 className="text-white font-medium">{insight.title}</h3>
          <p className="text-sm text-white/60 mt-1 line-clamp-2">{insight.description}</p>

          {insight.suggestedActions.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <button className="inline-flex items-center gap-1 text-xs text-nexus-400 hover:text-nexus-300 transition-colors">
                View {insight.suggestedActions.length} action{insight.suggestedActions.length > 1 ? 's' : ''}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-white/30">
          <Clock className="w-3 h-3" />
          <span>Just now</span>
        </div>
      </div>
    </div>
  );
}






