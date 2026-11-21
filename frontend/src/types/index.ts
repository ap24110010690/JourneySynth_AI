export type PageKey =
  | 'dashboard'
  | 'dataset'
  | 'generation'
  | 'validation'
  | 'analytics'
  | 'explorer'
  | 'model-testing'
  | 'api-docs'
  | 'history'
  | 'settings';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_login?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface DatasetRecord {
  id: string;
  name: string;
  source_type: 'sample' | 'uploaded' | 'cleaned' | 'synthetic' | string;
  file_path: string;
  row_count: number;
  customer_count: number;
  is_cleaned: boolean;
  parent_dataset_id?: string | null;
  created_at: string;
}

export interface ColumnSchemaInfo {
  column: string;
  dtype: string;
  sdtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  sample_values: (string | number | null)[];
}

export interface DatasetPreviewResponse {
  dataset_id: string;
  dataset_name: string;
  source_type: string;
  is_cleaned: boolean;
  row_count: number;
  column_count: number;
  customer_count: number;
  duplicate_rows: number;
  total_missing_values: number;
  columns: ColumnSchemaInfo[];
  preview_rows: Record<string, string | number | null>[];
  available_datasets: DatasetRecord[];
}

export interface DatasetCleanResponse {
  cleaned_dataset_id: string;
  source_dataset_id: string;
  file_path: string;
  original_rows: number;
  cleaned_rows: number;
  duplicates_removed: number;
  missing_values_before: number;
  missing_values_after: number;
  invalid_values_fixed: number;
  consistency_issues_fixed: number;
  operations_applied: string[];
  preview_rows: Record<string, string | number | null>[];
}

export interface TrainedModelRecord {
  id: string;
  model_type: string;
  dataset_id: string;
  model_path: string;
  metadata_path: string;
  epochs: number;
  batch_size: number;
  random_seed: number | null;
  status: string;
  training_duration_sec: number;
  row_count_trained: number;
  error_message?: string | null;
  created_at: string;
}

export interface ModelTrainResponse extends TrainedModelRecord {
  model_id: string;
  metadata_columns: Record<string, { sdtype?: string; datetime_format?: string; regex_format?: string }>;
  note: string;
}

export interface ModelStatusResponse {
  is_training: boolean;
  has_trained_model: boolean;
  active_model: TrainedModelRecord | null;
  trained_models: TrainedModelRecord[];
  sdv_available: boolean;
  sdv_version: string | null;
}

export interface SequenceDiagnostics {
  unique_customers: number;
  avg_interactions_per_customer: number;
  multi_channel_customer_pct: number;
  chronological_timestamp_pct: number;
  purchase_consistency_pct: number;
  valid_channel_pct: number;
  valid_interaction_pct: number;
}

export interface GenerateResponse {
  generation_id: string;
  dataset_id: string;
  model_id: string;
  model_type: string;
  num_records: number;
  customer_count: number;
  random_seed: number | null;
  customer_segment_filter: string | null;
  channel_filter: string | null;
  file_path: string;
  duration_sec: number;
  sequence_validation_note: string;
  sequence_diagnostics: SequenceDiagnostics;
  preview_rows: Record<string, string | number | null>[];
}

export interface GenerationHistoryRecord {
  id: string;
  model_id: string;
  model_type: string;
  dataset_id: string;
  source_dataset_id: string;
  num_records: number;
  random_seed: number | null;
  customer_segment_filter: string | null;
  channel_filter: string | null;
  file_path: string;
  quality_score: number | null;
  duration_sec: number;
  created_at: string;
}

export interface ValidationReport {
  report_id: string;
  synthetic_dataset_id: string;
  reference_dataset_id: string;
  synthetic_rows: number;
  reference_rows: number;
  overall_score: number;
  sdmetrics_score: number;
  sdmetrics_properties: Record<string, number>;
  pass_status: string;
  completeness: {
    missing_values: number;
    missing_pct: number;
    missing_required_columns: string[];
    completeness_score: number;
    status: string;
  };
  consistency: {
    valid_channel_pct: number;
    valid_interaction_type_pct: number;
    valid_timestamp_pct: number;
    valid_numerical_range_pct: number;
    consistency_score: number;
    status: string;
  };
  uniqueness: {
    duplicate_interaction_ids: number;
    duplicate_records: number;
    uniqueness_score: number;
    status: string;
  };
  column_results: {
    column: string;
    metric: string;
    score: number;
    status: string;
  }[];
  numerical_comparisons: {
    column: string;
    original_mean: number;
    synthetic_mean: number;
    original_std: number;
    synthetic_std: number;
  }[];
  categorical_comparisons: Record<
    string,
    { category: string; original_pct: number; synthetic_pct: number }[]
  >;
  journey_pattern_validation: SequenceDiagnostics & {
    transition_comparison: {
      transition: string;
      original_pct: number;
      synthetic_pct: number;
    }[];
  };
  privacy_disclaimer: string;
}

export interface OverviewMetrics {
  active_dataset: DatasetRecord;
  total_synthetic_customers: number;
  total_synthetic_interactions: number;
  total_customers: number;
  total_interactions: number;
  num_channels: number;
  avg_interactions_per_customer: number;
  dataset_quality_score: number | null;
  most_common_interaction: string;
  journey_completion_rate: number;
  channel_distribution: { channel: string; count: number; percentage: number }[];
  recent_generation_history: GenerationHistoryRecord[];
  total_generation_runs: number;
}

export interface ChannelAnalyticsResponse {
  dataset: DatasetRecord;
  channels: {
    channel: string;
    count: number;
    percentage: number;
    conversions: number;
    conversion_rate: number;
    total_revenue: number;
    avg_duration: number;
  }[];
  interaction_types: { interaction_type: string; count: number; percentage: number }[];
  journey_funnel: { stage: string; interactions: number; customers: number }[];
  daily_trend: { date: string; interactions: number; purchases: number; revenue: number }[];
  segments: {
    segment: string;
    customers: number;
    interactions: number;
    avg_touchpoints: number;
    conversion_rate: number;
    avg_purchase_amount: number;
  }[];
  product_categories: { category: string; interactions: number; purchases: number; revenue: number }[];
  touchpoint_distribution: { touchpoints: number; customers: number }[];
}

export interface ChannelTransitionsResponse {
  dataset: DatasetRecord;
  total_transitions: number;
  transitions: {
    from_channel: string;
    to_channel: string;
    label: string;
    count: number;
    percentage: number;
  }[];
}

export interface CustomerSummary {
  customer_id: string;
  interactions: number;
  channels: number;
  segment: string;
  converted: boolean;
  total_spend: number;
}

export interface CustomerTimelineResponse {
  dataset: DatasetRecord;
  customer_id: string;
  segment: string;
  location: string;
  total_interactions: number;
  channels_used: string[];
  total_purchase_amount: number;
  converted: boolean;
  timeline: {
    customer_id: string;
    interaction_id: string;
    session_id: string;
    channel: string;
    interaction_type: string;
    timestamp: string;
    product_category: string;
    device_type: string;
    location: string;
    campaign_source: string;
    interaction_duration: number;
    purchase_amount: number;
    conversion_status: string;
    customer_segment: string;
    journey_stage: string;
  }[];
}

export interface PersonalizationTrainResponse {
  dataset_id: string;
  dataset_name: string;
  model_name: string;
  train_rows: number;
  test_rows: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  confusion_matrix: number[][];
  labels: string[];
  features_used: string[];
  split_strategy: string;
  disclaimer: string;
}

export interface PersonalizationPredictResponse {
  predicted_conversion: boolean;
  conversion_probability: number;
  recommended_next_action: string;
  model_info: PersonalizationTrainResponse;
}
