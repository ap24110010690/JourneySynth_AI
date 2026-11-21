import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Cpu,
  Database,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import type { ChannelAnalyticsResponse, OverviewMetrics, PageKey } from '../types';

const CHANNEL_COLORS = ['#3B82F6', '#06B6D4', '#6366F1', '#10B981', '#F59E0B', '#EC4899'];

interface DashboardProps {
  onNavigate: (page: PageKey) => void;
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  refreshSignal: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, notify, refreshSignal }) => {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [channelData, setChannelData] = useState<ChannelAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, ch] = await Promise.all([api.getOverviewMetrics(), api.getChannelAnalytics()]);
      setOverview(ov);
      setChannelData(ch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
      setError(msg);
      notify('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[#0F172A] border border-slate-800/80 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl bg-[#0F172A] border border-slate-800/80 animate-pulse" />
          <div className="h-80 rounded-xl bg-[#0F172A] border border-slate-800/80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="rounded-xl bg-[#0F172A] border border-rose-500/30 p-8 text-center space-y-4">
        <p className="text-rose-300 font-medium">{error}</p>
        <p className="text-sm text-slate-400">
          Ensure the Python FastAPI backend is running on port 8000 and accessible.
        </p>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const kpis = [
    {
      label: 'Total Synthetic Customers',
      value: overview.total_synthetic_customers.toLocaleString(),
      sub:
        overview.total_synthetic_customers > 0
          ? `${overview.total_synthetic_interactions.toLocaleString()} synthetic events`
          : `Active source: ${overview.total_customers.toLocaleString()} customers`,
    },
    {
      label: 'Active Dataset Interactions',
      value: overview.total_interactions.toLocaleString(),
      sub: `${overview.num_channels} omnichannel touchpoints`,
    },
    {
      label: 'Avg Interactions / Customer',
      value: overview.avg_interactions_per_customer.toFixed(2),
      sub: `Top action: ${overview.most_common_interaction}`,
    },
    {
      label: 'Dataset Quality Score',
      value: overview.dataset_quality_score !== null ? `${overview.dataset_quality_score.toFixed(1)}%` : 'Pending',
      sub: `Journey completion: ${overview.journey_completion_rate.toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="rounded-xl bg-gradient-to-r from-[#0F172A] via-[#121F3B] to-[#0F172A] border border-slate-800/80 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-blue-400 font-medium">
            Omnichannel Synthetic Journey Pipeline · {overview.active_dataset.source_type.toUpperCase()}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100 text-balance">
            {overview.active_dataset.name}
          </h2>
          <p className="text-sm text-slate-400">
            {overview.total_customers.toLocaleString()} customers · {overview.total_interactions.toLocaleString()} interactions ·{' '}
            {overview.total_generation_runs} SDV generation runs recorded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('dataset')}
            className="px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Prepare Data</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('generation')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Train & Generate</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5 space-y-2"
          >
            <div className="text-xs font-medium text-slate-400">{kpi.label}</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-100">
              {kpi.value}
            </div>
            <div className="text-xs text-slate-400 truncate">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Distribution */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-100">Channel Distribution</h3>
              <p className="text-xs text-slate-400">Share of interactions across active omnichannel touchpoints</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>Deep Dive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.channel_distribution}
                  dataKey="count"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {overview.channel_distribution.map((entry, idx) => (
                    <Cell key={entry.channel} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-800/70">
            {overview.channel_distribution.map((ch, idx) => (
              <div key={ch.channel} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: CHANNEL_COLORS[idx % CHANNEL_COLORS.length] }}
                  />
                  <span className="text-slate-300 truncate">{ch.channel}</span>
                </div>
                <span className="font-mono tabular-nums text-slate-400 shrink-0">
                  {ch.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Interaction Type Frequency */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-100">Interaction Frequency</h3>
              <p className="text-xs text-slate-400">Counts computed by Pandas across active customer events</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('explorer')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>Explore Customers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={channelData?.interaction_types.slice(0, 8) || []}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="interaction_type"
                  stroke="#94A3B8"
                  fontSize={11}
                  width={115}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Generation Activity + Quick Workflow Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-100">Recent Generation Activity</h3>
              <p className="text-xs text-slate-400">SQLite audit log of SDV synthesis runs</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {overview.recent_generation_history.length === 0 ? (
            <div className="py-10 text-center space-y-3 border border-dashed border-slate-800 rounded-lg">
              <p className="text-sm text-slate-300">No synthetic datasets have been generated yet.</p>
              <p className="text-xs text-slate-400">
                Train an SDV synthesizer on the prepared dataset to produce synthetic customer journeys.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('generation')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Go to Synthetic Generation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 pr-4 font-medium">Dataset ID</th>
                    <th className="py-2.5 pr-4 font-medium">SDV Model</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Records</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Quality</th>
                    <th className="py-2.5 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {overview.recent_generation_history.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-4 font-mono text-slate-200">{run.dataset_id}</td>
                      <td className="py-2.5 pr-4 text-slate-300">{run.model_type}</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-slate-200">
                        {run.num_records.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-right">
                        {run.quality_score !== null ? (
                          <span className="text-emerald-400">{run.quality_score.toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-500">Not validated</span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono tabular-nums text-right text-slate-400">
                        {run.duration_sec.toFixed(2)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Workflow Actions</h3>
            <p className="text-xs text-slate-400">Recommended end-to-end execution order</p>
          </div>

          <div className="space-y-2.5">
            {[
              {
                title: '01. Prepare & Clean Dataset',
                desc: 'Inspect schema, handle missing values & duplicates',
                icon: Database,
                page: 'dataset' as PageKey,
              },
              {
                title: '02. Train SDV & Generate',
                desc: 'Fit CTGAN or GaussianCopula & sample records',
                icon: Cpu,
                page: 'generation' as PageKey,
              },
              {
                title: '03. Validate Statistical Quality',
                desc: 'Run SDMetrics QualityReport & sequence checks',
                icon: ShieldCheck,
                page: 'validation' as PageKey,
              },
              {
                title: '04. Analyze & Explore Journeys',
                desc: 'Inspect channel transitions & customer timelines',
                icon: Users,
                page: 'explorer' as PageKey,
              },
              {
                title: '05. Test Personalization Model',
                desc: 'Evaluate Scikit-learn conversion predictions',
                icon: BarChart3,
                page: 'model-testing' as PageKey,
              },
            ].map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.title}
                  type="button"
                  onClick={() => onNavigate(act.page)}
                  className="w-full text-left p-3 rounded-lg border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/40 transition-colors flex items-start gap-3"
                >
                  <Icon className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200">{act.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{act.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
