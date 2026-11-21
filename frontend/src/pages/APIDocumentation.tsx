import React, { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { api, buildApiUrl } from '../services/api';

interface EndpointSpec {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  sampleBody?: string;
}

const ENDPOINTS: EndpointSpec[] = [
  { method: 'GET', path: '/', summary: 'API root health status' },
  { method: 'GET', path: '/api/health', summary: 'Backend, SDV availability, and active model status' },
  {
    method: 'POST',
    path: '/api/auth/register',
    summary: 'Register a new user account with hashed password and PBKDF2 salt',
    sampleBody: JSON.stringify({ email: 'newuser@example.com', full_name: 'Alex Rivera', password: 'Password123!' }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    summary: 'Authenticate existing user and return 30-day session token',
    sampleBody: JSON.stringify({ email: 'demo@journeysynth.ai', password: 'demo123' }, null, 2),
  },
  { method: 'POST', path: '/api/auth/demo-login', summary: 'One-click evaluation login with demo user credentials' },
  { method: 'GET', path: '/api/auth/me', summary: 'Get current authenticated user profile (requires Bearer token)' },
  { method: 'POST', path: '/api/auth/logout', summary: 'Revoke active session token' },
  { method: 'GET', path: '/api/dataset/preview', summary: 'Return active dataset preview, missing values, and schema' },
  { method: 'POST', path: '/api/dataset/upload', summary: 'Upload an omnichannel CSV dataset (multipart/form-data)' },
  {
    method: 'POST',
    path: '/api/dataset/clean',
    summary: 'Run Pandas preprocessing, deduplication, and type normalization',
    sampleBody: JSON.stringify({ drop_duplicates: true, fill_missing: true, normalize_categories: true, enforce_types: true }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/model/train',
    summary: 'Train CTGANSynthesizer or GaussianCopulaSynthesizer on prepared data',
    sampleBody: JSON.stringify({ model_type: 'GaussianCopulaSynthesizer', epochs: 20, batch_size: 100, random_seed: 42 }, null, 2),
  },
  { method: 'GET', path: '/api/model/status', summary: 'Return trained SDV models and training state' },
  {
    method: 'POST',
    path: '/api/generate',
    summary: 'Sample synthetic customer journey records from trained SDV model',
    sampleBody: JSON.stringify({ num_records: 200, random_seed: 42 }, null, 2),
  },
  { method: 'GET', path: '/api/generate/history', summary: 'Return SQLite audit history of generation runs' },
  {
    method: 'POST',
    path: '/api/validate',
    summary: 'Validate synthetic dataset against reference data using SDMetrics',
    sampleBody: JSON.stringify({}, null, 2),
  },
  { method: 'GET', path: '/api/analytics/overview', summary: 'Return dashboard summary KPIs and channel breakdown' },
  { method: 'GET', path: '/api/analytics/channels', summary: 'Return channel distribution, funnel, trends, and segments' },
  { method: 'GET', path: '/api/analytics/transitions', summary: 'Return cross-channel transition frequencies' },
  { method: 'GET', path: '/api/analytics/customers/CUST-1001', summary: 'Return chronological timeline for a customer ID' },
  { method: 'GET', path: '/api/export/sample-default', summary: 'Export dataset as downloadable CSV' },
];

export const APIDocumentation: React.FC = () => {
  const [selected, setSelected] = useState<EndpointSpec>(ENDPOINTS[1]);
  const [customPath, setCustomPath] = useState(ENDPOINTS[1].path);
  const [bodyText, setBodyText] = useState('');
  const [responseText, setResponseText] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const handleSelect = (ep: EndpointSpec) => {
    setSelected(ep);
    setCustomPath(ep.path);
    setBodyText(ep.sampleBody || '');
    setResponseText('');
    setResponseStatus(null);
  };

  const handleExecute = async () => {
    if (selected.path === '/api/dataset/upload') {
      setResponseStatus(400);
      setResponseText('Use the Dataset Preparation page to upload multipart/form-data CSV files.');
      return;
    }
    setRunning(true);
    try {
      const res = await api.rawRequest(selected.method, customPath, bodyText || undefined);
      setResponseStatus(res.status);
      setResponseText(
        typeof res.data === 'string' ? res.data.slice(0, 4000) : JSON.stringify(res.data, null, 2)
      );
    } catch (err) {
      setResponseStatus(0);
      setResponseText(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            FastAPI REST API Documentation & Live Tester
          </h2>
          <p className="text-sm text-slate-400">
            Inspect all 15 REST endpoints with Pydantic schemas and execute live requests against FastAPI.
          </p>
        </div>

        <a
          href={buildApiUrl('/docs')}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open Swagger UI (/docs)</span>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints Directory */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4 divide-y divide-slate-800/60 max-h-[640px] overflow-y-auto">
          {ENDPOINTS.map((ep) => {
            const active = selected.path === ep.path && selected.method === ep.method;
            return (
              <button
                key={`${ep.method}-${ep.path}`}
                type="button"
                onClick={() => handleSelect(ep)}
                className={`w-full text-left px-3 py-3 transition-colors ${
                  active ? 'bg-blue-600/15' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`font-mono font-bold w-11 ${
                      ep.method === 'GET' ? 'text-emerald-400' : 'text-blue-400'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-slate-100 truncate">{ep.path}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 pl-[54px]">{ep.summary}</div>
              </button>
            );
          })}
        </div>

        {/* Live Request Runner */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-slate-100">
                {selected.method} {selected.path}
              </h3>
              <p className="text-xs text-slate-400">{selected.summary}</p>
            </div>
            <button
              type="button"
              onClick={handleExecute}
              disabled={running}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{running ? 'Sending...' : 'Send Request'}</span>
            </button>
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 mb-1">Request Path</label>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 font-mono text-slate-200"
            />
          </div>

          {selected.method === 'POST' && (
            <div className="text-xs">
              <label className="block text-slate-400 mb-1">JSON Request Payload</label>
              <textarea
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 font-mono text-slate-200"
              />
            </div>
          )}

          <div className="text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>Live Response</span>
              {responseStatus !== null && (
                <span className={`font-mono font-semibold ${responseStatus < 300 && responseStatus >= 200 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  HTTP {responseStatus}
                </span>
              )}
            </div>
            <pre className="p-3.5 rounded-lg bg-[#091020] border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
              {responseText || 'Click "Send Request" to inspect the live FastAPI JSON output.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
