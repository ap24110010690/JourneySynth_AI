import React, { useEffect, useState } from 'react';
import { AlertCircle, FlaskConical, Play } from 'lucide-react';
import { api } from '../services/api';
import type {
  DatasetRecord,
  PersonalizationPredictResponse,
  PersonalizationTrainResponse,
} from '../types';

const INTERACTIONS = [
  'Page View',
  'Product View',
  'Search',
  'Add to Cart',
  'Email Open',
  'Email Click',
  'App Open',
  'Store Visit',
  'Customer Support',
];
const CHANNELS = [
  'Website',
  'Mobile Application',
  'Email',
  'Physical Store',
  'Social Media',
  'Customer Support',
];
const SEGMENTS = [
  'High-Value Omnichannel',
  'Digital-First Explorer',
  'Store Loyalist',
  'Occasional Browser',
  'At-Risk Shopper',
];
const STAGES = ['Awareness', 'Consideration', 'Intent', 'Conversion', 'Retention'];

interface ModelTestingProps {
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ModelTesting: React.FC<ModelTestingProps> = ({ notify }) => {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [modelName, setModelName] = useState('RandomForestClassifier');
  const [testSize, setTestSize] = useState(0.2);
  const [training, setTraining] = useState(false);
  const [trainMetrics, setTrainMetrics] = useState<PersonalizationTrainResponse | null>(null);

  // Sample prediction inputs
  const [prevInteraction, setPrevInteraction] = useState('Add to Cart');
  const [channel, setChannel] = useState('Website');
  const [segment, setSegment] = useState('High-Value Omnichannel');
  const [stage, setStage] = useState('Intent');
  const [prevCount, setPrevCount] = useState(3);
  const [prevSpend, setPrevSpend] = useState(0);
  const [duration, setDuration] = useState(210);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PersonalizationPredictResponse | null>(null);

  useEffect(() => {
    api
      .listDatasets()
      .then((res) => {
        setDatasets(res.datasets);
        setSelectedDatasetId(
          res.active_synthetic_dataset_id ||
            res.active_cleaned_dataset_id ||
            res.datasets[0]?.id ||
            ''
        );
      })
      .catch(() => {});
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await api.trainPersonalization({
        dataset_id: selectedDatasetId || undefined,
        model_name: modelName,
        test_size: testSize,
        random_seed: 42,
      });
      setTrainMetrics(res);
      notify('success', `Trained ${res.model_name} (F1: ${res.f1_score}%)`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Model training failed');
    } finally {
      setTraining(false);
    }
  };

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const res = await api.predictPersonalization({
        previous_interaction_type: prevInteraction,
        channel,
        customer_segment: segment,
        journey_stage: stage,
        previous_interactions_count: prevCount,
        previous_purchase_amount: prevSpend,
        interaction_duration: duration,
      });
      setPrediction(res);
      if (!trainMetrics && res.model_info) {
        setTrainMetrics(res.model_info);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Experimental Demonstration Notice */}
      <div className="rounded-xl bg-[#0F172A] border border-blue-500/30 p-4 flex items-start gap-3 text-xs text-slate-300">
        <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-blue-300">Experimental Personalization Demonstration: </span>
          This Scikit-learn classifier benchmarks how generated synthetic journey features predict conversion likelihood.
          Customer-grouped splitting (<span className="font-mono">GroupShuffleSplit</span>) prevents customer-level data leakage across train and test partitions. Not a production recommendation engine.
        </div>
      </div>

      {/* Train Controls */}
      <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
            <div>
              <label className="block text-slate-400 mb-1.5">Benchmark Dataset</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5">Scikit-learn Classifier</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                <option value="RandomForestClassifier">RandomForestClassifier</option>
                <option value="GradientBoostingClassifier">GradientBoostingClassifier</option>
                <option value="LogisticRegression">LogisticRegression</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5">Test Split Ratio</label>
              <select
                value={testSize}
                onChange={(e) => setTestSize(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono"
              >
                <option value={0.2}>20% Holdout</option>
                <option value={0.25}>25% Holdout</option>
                <option value={0.3}>30% Holdout</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTrain}
            disabled={training}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-4 h-4" />
            <span>{training ? 'Training Classifier...' : 'Train & Evaluate Model'}</span>
          </button>
        </div>
      </div>

      {/* Metrics & Confusion Matrix + Live Prediction Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Evaluation Metrics & Confusion Matrix</h3>
            <p className="text-xs text-slate-400">
              {trainMetrics
                ? `${trainMetrics.model_name} · Train ${trainMetrics.train_rows} / Test ${trainMetrics.test_rows} rows`
                : 'Click "Train & Evaluate Model" to compute held-out classification metrics'}
            </p>
          </div>

          {trainMetrics ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Accuracy', value: `${trainMetrics.accuracy}%` },
                  { label: 'Precision', value: `${trainMetrics.precision}%` },
                  { label: 'Recall', value: `${trainMetrics.recall}%` },
                  { label: 'F1-Score', value: `${trainMetrics.f1_score}%` },
                ].map((m) => (
                  <div key={m.label} className="p-3.5 rounded-lg bg-[#091020] border border-slate-800">
                    <div className="text-[11px] text-slate-400">{m.label}</div>
                    <div className="font-mono tabular-nums text-lg font-bold text-slate-100 mt-1">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-300 mb-2">Confusion Matrix</div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums text-center">
                  <div />
                  <div className="py-1.5 text-slate-400">Pred: Not Conv</div>
                  <div className="py-1.5 text-slate-400">Pred: Converted</div>

                  <div className="py-3 text-right pr-2 text-slate-400">Actual: 0</div>
                  <div className="py-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                    {trainMetrics.confusion_matrix[0]?.[0] ?? 0}
                  </div>
                  <div className="py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    {trainMetrics.confusion_matrix[0]?.[1] ?? 0}
                  </div>

                  <div className="py-3 text-right pr-2 text-slate-400">Actual: 1</div>
                  <div className="py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    {trainMetrics.confusion_matrix[1]?.[0] ?? 0}
                  </div>
                  <div className="py-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold">
                    {trainMetrics.confusion_matrix[1]?.[1] ?? 0}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              No personalization evaluation run yet.
            </div>
          )}
        </div>

        {/* Interactive Sample Inference */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-6 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Interactive Journey Prediction Test</h3>
            <p className="text-xs text-slate-400">Test sample omnichannel context against the trained classifier</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Previous Interaction</label>
              <select
                value={prevInteraction}
                onChange={(e) => setPrevInteraction(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {INTERACTIONS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Current Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Customer Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Journey Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200"
              >
                {STAGES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Prior Touchpoints</label>
              <input
                type="number"
                min={0}
                value={prevCount}
                onChange={(e) => setPrevCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Interaction Duration (s)</label>
              <input
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#091020] border border-slate-700 text-slate-200 font-mono tabular-nums"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePredict}
            disabled={predicting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{predicting ? 'Scoring...' : 'Predict Conversion Probability'}</span>
          </button>

          {prediction && (
            <div className="p-4 rounded-lg bg-[#091020] border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Conversion Probability</span>
                <span className="font-mono tabular-nums text-lg font-bold text-blue-400">
                  {prediction.conversion_probability.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Predicted Class</span>
                <span className={prediction.predicted_conversion ? 'text-emerald-400 font-semibold' : 'text-slate-300 font-semibold'}>
                  {prediction.predicted_conversion ? 'Likely Conversion' : 'Non-Conversion Step'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-300">
                <span className="text-slate-400">Suggested Action: </span>
                {prediction.recommended_next_action}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
