import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  Play,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  DatasetRecord,
  GenerateResponse,
  ModelStatusResponse,
  ModelTrainResponse,
} from '../types';

const PRESET_COUNTS = [100, 500, 1000, 5000];
const SEGMENTS = [
  'All',
  'High-Value Omnichannel',
  'Digital-First Explorer',
  'Store Loyalist',
  'Occasional Browser',
  'At-Risk Shopper',
];
const CHANNELS = [
  'All',
  'Website',
  'Mobile Application',
  'Email',
  'Physical Store',
  'Social Media',
  'Customer Support',
];

interface SyntheticGenerationProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  onGenerated: () => void;
}

export const SyntheticGeneration: React.FC<SyntheticGenerationProps> = ({
  notify,
  onGenerated,
}) => {
  const [status, setStatus] = useState<ModelStatusResponse | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  // Training settings
  const [modelType, setModelType] = useState<'CTGANSynthesizer' | 'GaussianCopulaSynthesizer'>('CTGANSynthesizer');
  const [epochs, setEpochs] = useState(30);
  const [batchSize, setBatchSize] = useState(100);
  const [trainSeed, setTrainSeed] = useState<string>('42');
  const [training, setTraining] = useState(false);
  const [trainOutput, setTrainOutput] = useState<ModelTrainResponse | null>(null);

  // Generation settings
  const [numRecords, setNumRecords] = useState(500);
  const [customRecords, setCustomRecords] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [genSeed, setGenSeed] = useState<string>('42');
  const [generating, setGenerating] = useState(false);
  const [genOutput, setGenOutput] = useState<GenerateResponse | null>(null);

  const loadStatus = async () => {
    try {
      const [st, dsRes] = await Promise.all([api.getModelStatus(), api.listDatasets()]);
      setStatus(st);
      const nonSynth = dsRes.datasets.filter((d) => d.source_type !== 'synthetic');
      setDatasets(nonSynth);
      if (!selectedDatasetId) {
        setSelectedDatasetId(
          dsRes.active_cleaned_dataset_id || dsRes.active_raw_dataset_id || nonSynth[0]?.id || ''
        );
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load model status');
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await api.trainModel({
        dataset_id: selectedDatasetId || undefined,
        model_type: modelType,
        epochs,
        batch_size: batchSize,
        random_seed: trainSeed.trim() ? Number(trainSeed) : null,
      });
      setTrainOutput(res);
      notify(
        'success',
        `Trained ${res.model_type} on ${res.row_count_trained} records in ${res.training_duration_sec}s`
      );
      await loadStatus();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'SDV model training failed');
    } finally {
      setTraining(false);
    }
  };

  const handleGenerate = async () => {
    const count = customRecords.trim() ? Number(customRecords) : numRecords;
    if (!Number.isFinite(count) || count < 10 || count > 20000) {
      notify('error', 'Number of records must be between 10 and 20,000.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateSynthetic({
        model_id: status?.active_model?.id,
        num_records: count,
        random_seed: genSeed.trim() ? Number(genSeed) : null,
        customer_segment: segmentFilter === 'All' ? null : segmentFilter,
        channel: channelFilter === 'All' ? null : channelFilter,
      });
      setGenOutput(res);
      notify(
        'success',
        `Generated ${res.num_records} synthetic records (${res.customer_count} customers) using ${res.model_type}`
      );
      onGenerated();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Synthetic generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SDV Overview Header */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            SDV Synthetic Journey Generation
          </h2>
          <p className="text-sm text-slate-400">
            Configure SingleTableMetadata, train CTGANSynthesizer or GaussianCopulaSynthesizer, and sample synthetic omnichannel records.
          </p>
        </div>

        <div className="text-xs text-slate-300 font-mono shrink-0">
          SDV Engine: {status?.sdv_available ? `v${status.sdv_version}` : 'Unavailable'} ·{' '}
          {status?.has_trained_model
            ? `Active: ${status.active_model?.model_type}`
            : 'No model trained yet'}
        </div>
      </div>

      {/* Step 1: Model Training & Step 2: Synthetic Sampling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Train SDV Synthesizer */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="font-display font-semibold text-slate-100">
              1. Train SDV Synthesizer
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1.5">Training Dataset (Cleaned Preferred)</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.row_count} rows)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">SDV Synthesizer Architecture</label>
              <div className="grid grid-cols-2 gap-2">
                {(['CTGANSynthesizer', 'GaussianCopulaSynthesizer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelType(m)}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      modelType === m
                        ? 'bg-blue-600/15 border-blue-500 text-blue-300 font-semibold'
                        : 'bg-[#091020] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="truncate">{m}</div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                      {m === 'CTGANSynthesizer' ? 'Deep tabular GAN' : 'Copula statistical baseline'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1.5">Epochs (CTGAN)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={epochs}
                  disabled={modelType !== 'CTGANSynthesizer'}
                  onChange={(e) => setEpochs(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums disabled:opacity-40"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5">Batch Size</label>
                <input
                  type="number"
                  min={20}
                  max={500}
                  step={10}
                  value={batchSize}
                  disabled={modelType !== 'CTGANSynthesizer'}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums disabled:opacity-40"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5">Random Seed</label>
                <input
                  type="number"
                  value={trainSeed}
                  onChange={(e) => setTrainSeed(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleTrain}
              disabled={training}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Cpu className="w-4 h-4" />
              <span>{training ? 'Training SDV Synthesizer...' : `Train ${modelType}`}</span>
            </button>

            {trainOutput && (
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Model Saved: {trainOutput.model_id}</span>
                </div>
                <div className="text-slate-400 font-mono tabular-nums">
                  Trained on {trainOutput.row_count_trained} rows in {trainOutput.training_duration_sec}s
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Synthetic Journeys */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            <h3 className="font-display font-semibold text-slate-100">
              2. Sample Synthetic Customer Journeys
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1.5">Number of Synthetic Records</label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COUNTS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => {
                      setNumRecords(cnt);
                      setCustomRecords('');
                    }}
                    className={`py-2 rounded-lg border font-mono tabular-nums transition-colors ${
                      numRecords === cnt && !customRecords
                        ? 'bg-blue-600/15 border-blue-500 text-blue-300 font-semibold'
                        : 'bg-[#091020] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cnt.toLocaleString()}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom"
                  value={customRecords}
                  onChange={(e) => setCustomRecords(e.target.value)}
                  className="px-2 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1.5">Customer Segment</label>
                <select
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
                >
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5">Channel Condition</label>
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5">Sampling Seed</label>
                <input
                  type="number"
                  value={genSeed}
                  onChange={(e) => setGenSeed(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{generating ? 'Sampling Synthetic Records...' : 'Generate Synthetic Journeys'}</span>
            </button>

            <div className="p-3.5 rounded-lg bg-[#091020] border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Statistical Learning vs Sequential Coherence</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                SDV learns joint statistical distributions from source rows and does not automatically enforce strict Markovian event ordering. Post-generation sequence validation verifies timestamps, multi-channel coverage, and purchase consistency.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SDV SingleTableMetadata Inspector */}
      {trainOutput && (
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-3">
          <h3 className="font-display font-semibold text-slate-100">
            SDV SingleTableMetadata Schema
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
            {Object.entries(trainOutput.metadata_columns).map(([col, meta]) => (
              <div key={col} className="p-2.5 rounded-lg bg-[#091020] border border-slate-800">
                <div className="font-mono text-slate-200 truncate">{col}</div>
                <div className="text-blue-400 mt-0.5">{meta.sdtype || 'unknown'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Output & Sequence Diagnostics */}
      {genOutput && (
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-slate-100">
                Generated Synthetic Dataset: {genOutput.dataset_id}
              </h3>
              <p className="text-xs text-slate-400">
                {genOutput.num_records.toLocaleString()} records · {genOutput.customer_count.toLocaleString()} synthetic customers · Generated in {genOutput.duration_sec}s
              </p>
            </div>
            <a
              href={api.getExportUrl(genOutput.dataset_id)}
              download
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Synthetic CSV</span>
            </a>
          </div>

          {/* Sequence Coherence Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-[#091020] border border-slate-800">
              <div className="text-[11px] text-slate-400">Avg Events / Customer</div>
              <div className="font-mono tabular-nums text-lg font-bold text-slate-100 mt-1">
                {genOutput.sequence_diagnostics.avg_interactions_per_customer}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#091020] border border-slate-800">
              <div className="text-[11px] text-slate-400">Multi-Channel Customers</div>
              <div className="font-mono tabular-nums text-lg font-bold text-slate-100 mt-1">
                {genOutput.sequence_diagnostics.multi_channel_customer_pct}%
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#091020] border border-slate-800">
              <div className="text-[11px] text-slate-400">Purchase Consistency</div>
              <div className="font-mono tabular-nums text-lg font-bold text-emerald-400 mt-1">
                {genOutput.sequence_diagnostics.purchase_consistency_pct}%
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#091020] border border-slate-800">
              <div className="text-[11px] text-slate-400">Valid Channel Values</div>
              <div className="font-mono tabular-nums text-lg font-bold text-emerald-400 mt-1">
                {genOutput.sequence_diagnostics.valid_channel_pct}%
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  {Object.keys(genOutput.preview_rows[0] || {}).slice(0, 9).map((k) => (
                    <th key={k} className="py-2 pr-4 font-medium whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {genOutput.preview_rows.slice(0, 12).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    {Object.keys(genOutput.preview_rows[0] || {}).slice(0, 9).map((k) => (
                      <td key={k} className="py-2 pr-4 font-mono tabular-nums whitespace-nowrap text-slate-300">
                        {String(row[k] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
