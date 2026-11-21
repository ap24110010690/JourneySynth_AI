import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import type { DatasetCleanResponse, DatasetPreviewResponse } from '../types';

interface DatasetPreparationProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  onDatasetUpdated: () => void;
}

export const DatasetPreparation: React.FC<DatasetPreparationProps> = ({
  notify,
  onDatasetUpdated,
}) => {
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(undefined);
  const [cleanResult, setCleanResult] = useState<DatasetCleanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pandas cleaning options
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [fillMissing, setFillMissing] = useState(true);
  const [normalizeCategories, setNormalizeCategories] = useState(true);
  const [enforceTypes, setEnforceTypes] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPreview = async (datasetId?: string) => {
    setLoading(true);
    try {
      const res = await api.getDatasetPreview(datasetId, 30);
      setPreview(res);
      setSelectedDatasetId(res.dataset_id);
      if (selectedFeatures.length === 0) {
        setSelectedFeatures(res.columns.map((c) => c.column));
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load dataset preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadDataset(file);
      notify('success', `Uploaded ${res.dataset.name} (${res.dataset.row_count} rows)`);
      setCleanResult(null);
      await loadPreview(res.dataset.id);
      onDatasetUpdated();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'CSV upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClean = async () => {
    if (!preview) return;
    setCleaning(true);
    try {
      const res = await api.cleanDataset({
        dataset_id: preview.dataset_id,
        drop_duplicates: dropDuplicates,
        fill_missing: fillMissing,
        normalize_categories: normalizeCategories,
        enforce_types: enforceTypes,
        selected_features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
      });
      setCleanResult(res);
      notify(
        'success',
        `Cleaned dataset created (${res.cleaned_rows} rows, ${res.duplicates_removed} duplicates removed, ${res.missing_values_before} missing values resolved)`
      );
      await loadPreview(res.cleaned_dataset_id);
      onDatasetUpdated();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Dataset cleaning failed');
    } finally {
      setCleaning(false);
    }
  };

  const handleSelectDataset = async (id: string) => {
    try {
      await api.selectDataset(id);
      await loadPreview(id);
      onDatasetUpdated();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Could not switch dataset');
    }
  };

  const toggleFeature = (col: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const filteredRows = (preview?.preview_rows || []).filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Top Action & Upload Bar */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Customer Journey Dataset Preparation
          </h2>
          <p className="text-sm text-slate-400">
            Inspect schema, upload omnichannel CSV logs, and run Pandas preprocessing before SDV training.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            aria-label="Select dataset"
            value={selectedDatasetId || ''}
            onChange={(e) => handleSelectDataset(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 max-w-[260px]"
          >
            {(preview?.available_datasets || []).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.row_count} rows)
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload CSV'}</span>
          </button>

          {preview && (
            <a
              href={api.getExportUrl(preview.dataset_id)}
              download
              className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </a>
          )}
        </div>
      </div>

      {/* Dataset Health Metrics Strip */}
      {preview && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4">
            <div className="text-xs text-slate-400">Total Records</div>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-100 mt-1">
              {preview.row_count.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4">
            <div className="text-xs text-slate-400">Unique Customers</div>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-100 mt-1">
              {preview.customer_count.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4">
            <div className="text-xs text-slate-400">Missing Values</div>
            <div
              className={`font-mono tabular-nums text-xl font-bold mt-1 ${
                preview.total_missing_values > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {preview.total_missing_values}
            </div>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4">
            <div className="text-xs text-slate-400">Duplicate Rows</div>
            <div
              className={`font-mono tabular-nums text-xl font-bold mt-1 ${
                preview.duplicate_rows > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {preview.duplicate_rows}
            </div>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4">
            <div className="text-xs text-slate-400">Dataset State</div>
            <div
              className={`text-sm font-semibold mt-2 ${
                preview.is_cleaned ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {preview.is_cleaned ? 'Cleaned & Ready' : 'Raw / Uncleaned'}
            </div>
          </div>
        </div>
      )}

      {/* Pandas Preprocessing Controls + Cleaning Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Pandas Preprocessing Pipeline</h3>
            <p className="text-xs text-slate-400">Configure automated cleaning & normalization operations</p>
          </div>

          <div className="space-y-3 text-sm">
            {[
              {
                label: 'Remove duplicate records & interaction IDs',
                checked: dropDuplicates,
                onChange: setDropDuplicates,
              },
              {
                label: 'Impute missing values (mode / median)',
                checked: fillMissing,
                onChange: setFillMissing,
              },
              {
                label: 'Normalize channel & interaction categories',
                checked: normalizeCategories,
                onChange: setNormalizeCategories,
              },
              {
                label: 'Enforce numeric dtypes & ISO timestamps',
                checked: enforceTypes,
                onChange: setEnforceTypes,
              },
            ].map((opt) => (
              <label key={opt.label} className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={(e) => opt.onChange(e.target.checked)}
                  className="mt-1 rounded border-slate-600 bg-slate-900 text-blue-600"
                />
                <span className="text-xs leading-relaxed">{opt.label}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClean}
            disabled={cleaning || loading}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{cleaning ? 'Running Pandas Pipeline...' : 'Clean & Prepare Dataset'}</span>
          </button>

          {cleanResult && (
            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Cleaning Completed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono tabular-nums">
                <div>Rows: {cleanResult.original_rows} → {cleanResult.cleaned_rows}</div>
                <div>Duplicates: -{cleanResult.duplicates_removed}</div>
                <div>Nulls: {cleanResult.missing_values_before} → {cleanResult.missing_values_after}</div>
                <div>Fixed Values: {cleanResult.invalid_values_fixed + cleanResult.consistency_issues_fixed}</div>
              </div>
              <ul className="space-y-1 text-slate-400 pt-1">
                {cleanResult.operations_applied.map((op) => (
                  <li key={op}>· {op}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Schema & Feature Selection */}
        <div className="lg:col-span-2 rounded-xl bg-[#0F172A] border border-slate-800/80 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-100">
                Dataset Schema & Feature Selection
              </h3>
              <p className="text-xs text-slate-400">
                {preview?.column_count || 0} columns inspected · Uncheck optional columns before cleaning if desired
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0F172A] border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">Use</th>
                  <th className="py-2 pr-3 font-medium">Column</th>
                  <th className="py-2 pr-3 font-medium">Pandas Dtype</th>
                  <th className="py-2 pr-3 font-medium">SDV sdtype</th>
                  <th className="py-2 pr-3 font-medium text-right">Nulls</th>
                  <th className="py-2 font-medium text-right">Unique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(preview?.columns || []).map((col) => (
                  <tr key={col.column} className="hover:bg-slate-800/30">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(col.column)}
                        onChange={() => toggleFeature(col.column)}
                        aria-label={`Include ${col.column}`}
                        className="rounded border-slate-600 bg-slate-900 text-blue-600"
                      />
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-200">{col.column}</td>
                    <td className="py-2 pr-3 font-mono text-slate-400">{col.dtype}</td>
                    <td className="py-2 pr-3 text-blue-400">{col.sdtype}</td>
                    <td
                      className={`py-2 pr-3 font-mono tabular-nums text-right ${
                        col.null_count > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {col.null_count} ({col.null_pct}%)
                    </td>
                    <td className="py-2 font-mono tabular-nums text-right text-slate-300">
                      {col.unique_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <h3 className="font-display font-semibold text-slate-100">Dataset Records Preview</h3>
            <span className="text-xs text-slate-400">· Showing first {filteredRows.length} rows</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter preview rows..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                {(preview?.columns || []).slice(0, 10).map((col) => (
                  <th key={col.column} className="py-2.5 pr-4 font-medium whitespace-nowrap">
                    {col.column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  {(preview?.columns || []).slice(0, 10).map((col) => {
                    const val = row[col.column];
                    return (
                      <td
                        key={col.column}
                        className="py-2 pr-4 font-mono tabular-nums whitespace-nowrap text-slate-300"
                      >
                        {val === null || val === undefined || val === '' ? (
                          <span className="text-amber-400">NULL</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
