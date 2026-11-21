import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Search, User } from 'lucide-react';
import { api } from '../services/api';
import type {
  CustomerSummary,
  CustomerTimelineResponse,
  DatasetRecord,
} from '../types';

interface CustomerExplorerProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const CustomerExplorer: React.FC<CustomerExplorerProps> = ({ notify }) => {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [timeline, setTimeline] = useState<CustomerTimelineResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const loadCustomers = async (datasetId?: string, q?: string) => {
    setLoadingList(true);
    try {
      const [dsRes, custRes] = await Promise.all([
        api.listDatasets(),
        api.listCustomers(datasetId, q),
      ]);
      setDatasets(dsRes.datasets);
      const resolvedId = datasetId || custRes.dataset.id;
      setSelectedDatasetId(resolvedId);
      setCustomers(custRes.customers);
      if (custRes.customers.length > 0) {
        const firstId = custRes.customers[0].customer_id;
        setSelectedCustomerId(firstId);
        await loadTimeline(firstId, resolvedId);
      } else {
        setTimeline(null);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoadingList(false);
    }
  };

  const loadTimeline = async (custId: string, datasetId?: string) => {
    setLoadingTimeline(true);
    try {
      const res = await api.getCustomerTimeline(custId, datasetId);
      setTimeline(res);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to load customer timeline');
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(selectedDatasetId, search);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Customer Journey Explorer
          </h2>
          <p className="text-sm text-slate-400">
            Select any customer ID to inspect chronological touchpoints, channels, interaction types, and conversion paths.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            aria-label="Select dataset"
            value={selectedDatasetId}
            onChange={(e) => loadCustomers(e.target.value, search)}
            className="px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 max-w-[260px]"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.customer_count} customers)
              </option>
            ))}
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer ID..."
                className="pl-8 pr-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 w-48"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
            >
              Find
            </button>
          </form>
        </div>
      </div>

      {/* Split Explorer: Customer Directory + Chronological Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer List */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-4 flex flex-col max-h-[680px]">
          <div className="px-2 pb-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Customers ({customers.length})</span>
            <span>Events / Spend</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 mt-1">
            {loadingList ? (
              <div className="p-4 text-xs text-slate-400">Loading customer directory...</div>
            ) : customers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No customers match your search filter.
              </div>
            ) : (
              customers.map((c) => {
                const active = c.customer_id === selectedCustomerId;
                return (
                  <button
                    key={c.customer_id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(c.customer_id);
                      loadTimeline(c.customer_id, selectedDatasetId);
                    }}
                    className={`w-full text-left px-3 py-3 transition-colors flex items-center justify-between gap-2 ${
                      active ? 'bg-blue-600/15 text-blue-300' : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold truncate">{c.customer_id}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {c.segment} · {c.channels} ch
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-xs text-slate-200">{c.interactions} events</div>
                      <div className={`text-[11px] ${c.converted ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {c.converted ? `$${c.total_spend.toFixed(0)}` : 'No purchase'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Chronological Journey Timeline */}
        <div className="lg:col-span-2 rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-6">
          {loadingTimeline ? (
            <div className="h-64 animate-pulse rounded-lg bg-slate-900/60" />
          ) : !timeline ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Select a customer from the directory to inspect their omnichannel journey timeline.
            </div>
          ) : (
            <>
              {/* Customer Profile Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-mono text-base font-bold text-slate-100">
                      {timeline.customer_id}
                    </div>
                    <div className="text-xs text-slate-400">
                      {timeline.segment} · {timeline.location}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
                  <div>
                    <div className="text-slate-400 font-sans">Events</div>
                    <div className="text-slate-100 font-semibold">{timeline.total_interactions}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-sans">Channels</div>
                    <div className="text-slate-100 font-semibold">{timeline.channels_used.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-sans">Total Spend</div>
                    <div className="text-emerald-400 font-semibold">
                      ${timeline.total_purchase_amount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-sans">Status</div>
                    <div className={timeline.converted ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                      {timeline.converted ? 'Converted' : 'In Journey'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Sequence Flow Strip */}
              <div className="p-4 rounded-lg bg-[#091020] border border-slate-800">
                <div className="text-[11px] text-slate-400 mb-2">Chronological Path Summary</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {timeline.timeline.map((step, i) => (
                    <React.Fragment key={step.interaction_id + i}>
                      <span className="text-slate-200 font-medium">
                        {step.channel}: <span className="text-blue-400">{step.interaction_type}</span>
                      </span>
                      {i < timeline.timeline.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Detailed Step-by-Step Timeline */}
              <div className="space-y-3">
                {timeline.timeline.map((step, idx) => {
                  const isPurchase = step.interaction_type === 'Purchase';
                  return (
                    <div
                      key={step.interaction_id + idx}
                      className="p-4 rounded-lg bg-[#091020] border border-slate-800/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-slate-500">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="font-semibold text-slate-100">{step.channel}</span>
                          <span className="text-slate-600">·</span>
                          <span className={isPurchase ? 'text-emerald-400 font-semibold' : 'text-blue-400 font-medium'}>
                            {step.interaction_type}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{step.journey_stage}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                          <span>{step.product_category}</span>
                          <span>·</span>
                          <span>{step.device_type}</span>
                          <span>·</span>
                          <span>{step.campaign_source}</span>
                          <span>·</span>
                          <span className="font-mono">{step.session_id}</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col sm:items-end justify-between gap-1 text-xs font-mono tabular-nums shrink-0">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{step.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-slate-400">{step.interaction_duration}s</span>
                          {step.purchase_amount > 0 && (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />${step.purchase_amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
