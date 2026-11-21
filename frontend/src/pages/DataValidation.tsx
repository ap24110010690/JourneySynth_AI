import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import type { DatasetRecord, ValidationReport } from '../types';

interface DataValidationProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  onValidated: () => void;
}

export const DataValidation: React.FC<DataValidationProps> = ({ notify, onValidated }) => {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [synthDatasets, setSynthDatasets] = useState<DatasetRecord[]>([]);
  const [selectedSynthId, setSelectedSynthId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCompareCol, setActiveCompareCol] = useState<'channel' | 'interaction_type' | 'customer_segment'>('channel');

  const initLoad = async () => {
    setLoading(true);
    try {
      const [dsRes, latestRes] = await Promise.all([api.listDatasets(), api.getLatestValidation()]);
      const synths = dsRes.datasets.filter((d) => d.source_type === 'synthetic');
      setSynthDatasets(synths);
      setSelectedSynthId(dsRes.active_synthetic_dataset_id || synths[0]?.id || '');
      if (latestRes.has_report && latestRes.report) {
        setReport(latestRes.report);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load validation state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initLoad();
  }, []);

  const handleRunValidation = async () => {
    setRunning(true);
    try {
      const res = await api.validateSynthetic({
        synthetic_dataset_id: selectedSynthId || undefined,
      });
      setReport(res);
      notify('success', `Validation completed: ${res.overall_score}% (${res.pass_status})`);
      onValidated();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="h-64 rounded-xl bg-[#0F172A] border border-slate-800/80 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Journey Data Quality Validation
          </h2>
          <p className="text-sm text-slate-400">
            Evaluate completeness, consistency, uniqueness, SDMetrics statistical similarity, and journey transition patterns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            aria-label="Select synthetic dataset"
            value={selectedSynthId}
            onChange={(e) => setSelectedSynthId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 max-w-[260px]"
          >
            {synthDatasets.length === 0 ? (
              <option value="">No synthetic dataset generated</option>
            ) : (
              synthDatasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={handleRunValidation}
            disabled={running || synthDatasets.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{running ? 'Running SDMetrics...' : 'Run Validation Report'}</span>
          </button>
        </div>
      </div>

      {!report ? (
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-12 text-center space-y-3">
          <p className="text-slate-200 font-medium">No validation report generated yet.</p>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {synthDatasets.length === 0
              ? 'First train an SDV synthesizer and generate synthetic records in the Synthetic Generation page.'
              : 'Click "Run Validation Report" above to compare your synthetic dataset against the prepared reference dataset.'}
          </p>
        </div>
      ) : (
        <>
          {/* Overall Score & 4 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5">
              <div className="text-xs text-slate-400">Overall Quality Score</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono tabular-nums text-2xl font-bold text-slate-100">
                  {report.overall_score.toFixed(1)}%
                </span>
                <span
                  className={`text-xs font-semibold ${
                    report.pass_status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {report.pass_status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                SDMetrics: {report.sdmetrics_score.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5">
              <div className="text-xs text-slate-400">A. Completeness</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-400 mt-1">
                {report.completeness.completeness_score}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Missing cells: {report.completeness.missing_values}
              </div>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5">
              <div className="text-xs text-slate-400">B. Consistency</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-100 mt-1">
                {report.consistency.consistency_score}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Valid channels: {report.consistency.valid_channel_pct}%
              </div>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5">
              <div className="text-xs text-slate-400">C. Uniqueness</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-400 mt-1">
                {report.uniqueness.uniqueness_score}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Duplicate IDs: {report.uniqueness.duplicate_interaction_ids}
              </div>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5">
              <div className="text-xs text-slate-400">D. Column Pair Trends</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-blue-400 mt-1">
                {(report.sdmetrics_properties['Column Pair Trends'] ?? report.sdmetrics_score).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {report.synthetic_rows} synth vs {report.reference_rows} ref
              </div>
            </div>
          </div>

          {/* Statistical Similarity vs Privacy Disclaimer */}
          <div className="rounded-xl bg-[#0F172A] border border-amber-500/30 p-4 flex items-start gap-3 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-amber-300">Statistical Similarity vs Privacy Distinction: </span>
              {report.privacy_disclaimer}
            </div>
          </div>

          {/* Distribution Comparison Chart + Numerical Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-slate-100">
                    Original vs Synthetic Distributions
                  </h3>
                  <p className="text-xs text-slate-400">Percentage share comparison</p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#091020] border border-slate-800">
                  {(['channel', 'interaction_type', 'customer_segment'] as const).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setActiveCompareCol(col)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap ${
                        activeCompareCol === col
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {col.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.categorical_comparisons[activeCompareCol] || []}
                    margin={{ top: 8, right: 12, left: 0, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="category"
                      stroke="#94A3B8"
                      fontSize={10}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis stroke="#64748B" fontSize={11} unit="%" />
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
                    <Bar dataKey="original_pct" name="Original %" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="synthetic_pct" name="Synthetic %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Journey Pattern Validation */}
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
              <div>
                <h3 className="font-display font-semibold text-slate-100">
                  E. Journey Pattern & Transition Validation
                </h3>
                <p className="text-xs text-slate-400">
                  Channel-to-channel transition rates (Original vs Synthetic)
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.journey_pattern_validation.transition_comparison}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                    <XAxis type="number" stroke="#64748B" fontSize={11} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="transition"
                      stroke="#94A3B8"
                      fontSize={10}
                      width={150}
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
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="original_pct" name="Original %" fill="#64748B" />
                    <Bar dataKey="synthetic_pct" name="Synthetic %" fill="#06B6D4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Column-Level SDMetrics Quality + Numerical Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
              <h3 className="font-display font-semibold text-slate-100 mb-4">
                SDMetrics Column-Level Shapes
              </h3>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-4 font-medium">Column</th>
                      <th className="py-2 pr-4 font-medium">SDMetrics Test</th>
                      <th className="py-2 pr-4 font-medium text-right">Score</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.column_results.map((col) => (
                      <tr key={col.column} className="hover:bg-slate-800/30">
                        <td className="py-2 pr-4 font-mono text-slate-200">{col.column}</td>
                        <td className="py-2 pr-4 text-slate-400">{col.metric}</td>
                        <td className="py-2 pr-4 font-mono tabular-nums text-right text-slate-200">
                          {col.score.toFixed(1)}%
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              col.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {col.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-5">
              <div>
                <h3 className="font-display font-semibold text-slate-100 mb-3">
                  Numerical Mean & Standard Deviation Comparison
                </h3>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3 font-medium">Feature</th>
                      <th className="py-2 pr-3 font-medium text-right">Orig Mean</th>
                      <th className="py-2 pr-3 font-medium text-right">Synth Mean</th>
                      <th className="py-2 pr-3 font-medium text-right">Orig Std</th>
                      <th className="py-2 font-medium text-right">Synth Std</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.numerical_comparisons.map((n) => (
                      <tr key={n.column}>
                        <td className="py-2.5 pr-3 font-mono text-slate-200">{n.column}</td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-slate-300">
                          {n.original_mean.toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-blue-400">
                          {n.synthetic_mean.toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-slate-400">
                          {n.original_std.toFixed(2)}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-right text-slate-400">
                          {n.synthetic_std.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-200 mb-2">
                  Journey Coherence Diagnostics
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-mono tabular-nums">
                  <div>Multi-Channel Customers: {report.journey_pattern_validation.multi_channel_customer_pct}%</div>
                  <div>Avg Touchpoints: {report.journey_pattern_validation.avg_interactions_per_customer}</div>
                  <div>Chronological Timestamps: {report.journey_pattern_validation.chronological_timestamp_pct}%</div>
                  <div>Purchase Consistency: {report.journey_pattern_validation.purchase_consistency_pct}%</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
