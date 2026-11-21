import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import type { GenerationHistoryRecord, PageKey } from '../types';

interface GenerationHistoryProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  onNavigate: (page: PageKey) => void;
}

export const GenerationHistory: React.FC<GenerationHistoryProps> = ({
  notify,
  onNavigate,
}) => {
  const [history, setHistory] = useState<GenerationHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.getGenerationHistory();
      setHistory(res.history);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load generation history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleValidateRun = async (datasetId: string) => {
    try {
      const res = await api.validateSynthetic({ synthetic_dataset_id: datasetId });
      notify('success', `Validated ${datasetId}: ${res.overall_score}% (${res.pass_status})`);
      await loadHistory();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Validation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Synthetic Generation History
          </h2>
          <p className="text-sm text-slate-400">
            Persistent SQLite log of every SDV synthesis run, hyperparameters, validation score, and CSV export.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Log</span>
        </button>
      </div>

      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
        {history.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-300">No generation runs recorded in SQLite yet.</p>
            <button
              type="button"
              onClick={() => onNavigate('generation')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Generate Your First Synthetic Dataset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Dataset ID</th>
                  <th className="py-2.5 pr-4 font-medium">Model</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Records</th>
                  <th className="py-2.5 pr-4 font-medium">Filters</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Seed</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Quality</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Time</th>
                  <th className="py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4 font-mono text-slate-100">{run.dataset_id}</td>
                    <td className="py-3 pr-4 text-slate-300">{run.model_type}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-right text-slate-200">
                      {run.num_records.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {[run.customer_segment_filter, run.channel_filter].filter(Boolean).join(' · ') || 'Unfiltered'}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-right text-slate-400">
                      {run.random_seed ?? 'Auto'}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-right">
                      {run.quality_score !== null ? (
                        <span className="text-emerald-400 font-semibold">{run.quality_score.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-right text-slate-400">
                      {run.duration_sec.toFixed(2)}s
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleValidateRun(run.dataset_id)}
                          className="px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-800 text-slate-200 inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Validate</span>
                        </button>
                        <a
                          href={api.getExportUrl(run.dataset_id)}
                          download
                          className="px-2.5 py-1 rounded bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>CSV</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
