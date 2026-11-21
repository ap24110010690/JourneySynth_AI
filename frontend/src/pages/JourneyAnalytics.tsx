import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import type {
  ChannelAnalyticsResponse,
  ChannelTransitionsResponse,
  DatasetRecord,
} from '../types';

const COLORS = ['#3B82F6', '#06B6D4', '#6366F1', '#10B981', '#F59E0B', '#EC4899'];

interface JourneyAnalyticsProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const JourneyAnalytics: React.FC<JourneyAnalyticsProps> = ({ notify }) => {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [analytics, setAnalytics] = useState<ChannelAnalyticsResponse | null>(null);
  const [transitions, setTransitions] = useState<ChannelTransitionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async (datasetId?: string) => {
    setLoading(true);
    try {
      const [dsRes, chRes, trRes] = await Promise.all([
        api.listDatasets(),
        api.getChannelAnalytics(datasetId),
        api.getChannelTransitions(datasetId),
      ]);
      setDatasets(dsRes.datasets);
      setSelectedDatasetId(datasetId || chRes.dataset.id);
      setAnalytics(chRes);
      setTransitions(trRes);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading && !analytics) {
    return <div className="h-96 rounded-xl bg-[#0F172A] border border-slate-800/80 animate-pulse" />;
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Header + Dataset Selector */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Omnichannel Journey Analysis
          </h2>
          <p className="text-sm text-slate-400">
            Pandas-computed channel distributions, conversion funnels, daily interaction trends, and customer segment behavior.
          </p>
        </div>
        <select
          aria-label="Select dataset for analytics"
          value={selectedDatasetId}
          onChange={(e) => loadAnalytics(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 max-w-[280px]"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.row_count} rows)
            </option>
          ))}
        </select>
      </div>

      {/* Row 1: Channel Pie + Interaction Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Channel Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Omnichannel touchpoint volume & share</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.channels}
                  dataKey="count"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {analytics.channels.map((ch, idx) => (
                    <Cell key={ch.channel} fill={COLORS[idx % COLORS.length]} />
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
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/70 text-xs">
            {analytics.channels.map((c, idx) => (
              <div key={c.channel} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-300 truncate">{c.channel}</span>
                </div>
                <span className="font-mono tabular-nums text-slate-400">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Interaction Frequency</h3>
          <p className="text-xs text-slate-400 mb-4">Event breakdown across all 11 supported interaction types</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.interaction_types} margin={{ top: 4, right: 12, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="interaction_type"
                  stroke="#94A3B8"
                  fontSize={10}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Journey Funnel + Channel Transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Customer Journey Stage Funnel</h3>
          <p className="text-xs text-slate-400 mb-4">Unique customers & interactions per lifecycle stage</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.journey_funnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="stage" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="interactions" name="Interactions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="customers" name="Unique Customers" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Top Channel Transitions</h3>
          <p className="text-xs text-slate-400 mb-4">
            Sequential cross-channel handoffs ({transitions?.total_transitions.toLocaleString() || 0} transitions)
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(transitions?.transitions || []).slice(0, 8)}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="label" stroke="#94A3B8" fontSize={10} width={165} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Transitions" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Daily Trend + Segment Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Daily Interaction Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Chronological interaction & conversion volume</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1222',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="interactions"
                  name="Interactions"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="Purchases"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <h3 className="font-display font-semibold text-slate-100 mb-1">Customer Segment Performance</h3>
          <p className="text-xs text-slate-400 mb-4">Touchpoints, conversion rate, and average purchase value</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Segment</th>
                  <th className="py-2 pr-3 font-medium text-right">Customers</th>
                  <th className="py-2 pr-3 font-medium text-right">Avg Touchpoints</th>
                  <th className="py-2 pr-3 font-medium text-right">Conv Rate</th>
                  <th className="py-2 font-medium text-right">Avg Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {analytics.segments.map((seg) => (
                  <tr key={seg.segment} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-3 text-slate-200 font-medium">{seg.segment}</td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-slate-300">
                      {seg.customers}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-slate-300">
                      {seg.avg_touchpoints.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-emerald-400">
                      {seg.conversion_rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 font-mono tabular-nums text-right text-slate-200">
                      ${seg.avg_purchase_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 4: Channel Conversion & Revenue Table */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
        <h3 className="font-display font-semibold text-slate-100 mb-4">
          Channel Conversion & Revenue Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium text-right">Interactions</th>
                <th className="py-2 pr-4 font-medium text-right">Share</th>
                <th className="py-2 pr-4 font-medium text-right">Conversions</th>
                <th className="py-2 pr-4 font-medium text-right">Conversion Rate</th>
                <th className="py-2 pr-4 font-medium text-right">Avg Duration (s)</th>
                <th className="py-2 font-medium text-right">Attributed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analytics.channels.map((ch) => (
                <tr key={ch.channel} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-medium text-slate-200">{ch.channel}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-slate-300">
                    {ch.count.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-slate-400">
                    {ch.percentage.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-emerald-400">
                    {ch.conversions.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-slate-300">
                    {ch.conversion_rate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right text-slate-400">
                    {ch.avg_duration.toFixed(1)}s
                  </td>
                  <td className="py-2.5 font-mono tabular-nums text-right text-slate-100">
                    ${ch.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
