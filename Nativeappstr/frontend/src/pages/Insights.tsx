import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Target,
  Shield,
  Zap,
  Clock,
  CheckCircle,
  ArrowRight,
  Filter
} from 'lucide-react';
import clsx from 'clsx';
import { getInsights, acknowledgeInsight, type ProactiveInsight } from '../api/client';

const insightTypes = [
  { value: '', label: 'All Types', icon: Sparkles },
  { value: 'anomaly', label: 'Anomalies', icon: AlertTriangle },
  { value: 'opportunity', label: 'Opportunities', icon: Target },
  { value: 'trend', label: 'Trends', icon: TrendingUp },
  { value: 'risk', label: 'Risks', icon: Shield },
  { value: 'optimization', label: 'Optimizations', icon: Zap }
];

export function Insights() {
  const [selectedType, setSelectedType] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['insights', selectedType],
    queryFn: () => getInsights(selectedType || undefined, 50)
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    }
  });

  const severityCounts = {
    critical: data?.insights.filter(i => i.severity === 'critical').length || 0,
    warning: data?.insights.filter(i => i.severity === 'warning').length || 0,
    info: data?.insights.filter(i => i.severity === 'info').length || 0
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Proactive Insights</h1>
          <p className="text-white/50 mt-1">AI-generated anomalies, opportunities, and recommendations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-error">{severityCounts.critical} Critical</span>
            <span className="badge-warning">{severityCounts.warning} Warning</span>
            <span className="badge-info">{severityCounts.info} Info</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-white/40" />
        {insightTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedType === type.value
                ? 'bg-nexus-600/20 text-nexus-400 border border-nexus-500/30'
                : 'bg-surface-tertiary/50 text-white/60 hover:bg-surface-tertiary hover:text-white border border-white/5'
            )}
          >
            <type.icon className="w-4 h-4" />
            {type.label}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Sparkles className="w-8 h-8 text-nexus-400 mx-auto mb-3 animate-pulse" />
          <p className="text-white/60">Loading insights...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {data?.insights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <InsightCard
                insight={insight}
                onAcknowledge={() => acknowledgeMutation.mutate(insight.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {data?.insights.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No insights found</h3>
          <p className="text-white/50">
            {selectedType
              ? `No ${selectedType} insights at this time`
              : 'The AI is continuously monitoring for insights'}
          </p>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  onAcknowledge
}: {
  insight: ProactiveInsight;
  onAcknowledge: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const severityConfig = {
    info: { color: 'text-status-info', bg: 'bg-status-info/10', border: 'border-status-info/20' },
    warning: { color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/20' },
    critical: { color: 'text-status-error', bg: 'bg-status-error/10', border: 'border-status-error/20' }
  };

  const typeIcons: Record<string, typeof Sparkles> = {
    anomaly: AlertTriangle,
    opportunity: Target,
    trend: TrendingUp,
    risk: Shield,
    optimization: Zap
  };

  const config = severityConfig[insight.severity];
  const Icon = typeIcons[insight.type] || Sparkles;

  return (
    <div className={clsx('glass-card overflow-hidden', config.border, 'border')}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2 rounded-lg', config.bg)}>
              <Icon className={clsx('w-5 h-5', config.color)} />
            </div>
            <div>
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                {insight.type}
              </span>
              <h3 className="text-white font-medium">{insight.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Clock className="w-3 h-3" />
            {new Date(insight.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-white/60 mb-4">{insight.description}</p>

        {/* Confidence */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/40">Confidence</span>
              <span className="text-white/60">{Math.round(insight.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', config.bg.replace('/10', ''))}
                style={{ width: `${insight.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Data Points */}
        {insight.dataPoints.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {insight.dataPoints.slice(0, 3).map((dp, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-surface-tertiary/50 rounded-lg text-xs text-white/60"
              >
                {dp.metric}: {dp.value.toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-nexus-400 hover:text-nexus-300 flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Show'} {insight.suggestedActions.length} actions
            <ArrowRight className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
          </button>
          <button
            onClick={onAcknowledge}
            className="btn-secondary text-sm py-2 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Acknowledge
          </button>
        </div>
      </div>

      {/* Expanded Actions */}
      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-white/5 mt-4">
          <h4 className="text-sm font-medium text-white mb-3">Suggested Actions</h4>
          <div className="space-y-2">
            {insight.suggestedActions.map((action) => (
              <div
                key={action.id}
                className="p-3 bg-surface-tertiary/50 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="text-sm text-white">{action.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white/40">Impact: {action.impact}</span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/40">Effort: {action.effort}</span>
                    {action.automatable && (
                      <>
                        <span className="text-xs text-white/40">•</span>
                        <span className="text-xs text-accent-cyan">Automatable</span>
                      </>
                    )}
                  </div>
                </div>
                {action.requiresApproval && (
                  <span className="badge-warning text-xs">Needs Approval</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}






