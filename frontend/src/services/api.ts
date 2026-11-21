import type {
  AuthResponse,
  ChannelAnalyticsResponse,
  ChannelTransitionsResponse,
  CustomerSummary,
  CustomerTimelineResponse,
  DatasetCleanResponse,
  DatasetPreviewResponse,
  DatasetRecord,
  GenerateResponse,
  GenerationHistoryRecord,
  ModelStatusResponse,
  ModelTrainResponse,
  OverviewMetrics,
  PersonalizationPredictResponse,
  PersonalizationTrainResponse,
  User,
  ValidationReport,
} from '../types';

const STORAGE_KEY_API_URL = 'journeysynth_api_base_url';
const STORAGE_KEY_AUTH_TOKEN = 'journeysynth_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function getDefaultApiBaseUrl(): string {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY_API_URL) : null;
  if (saved !== null) {
    return saved;
  }
  const envUrl = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  // When running standalone Vite locally on 5173, connect to FastAPI on 127.0.0.1:8000;
  // When served via port 3000 or Cloud Run preview, use Vite/server relative /api proxy.
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
    window.location.port === '5173'
  ) {
    return 'http://127.0.0.1:8000';
  }
  return '';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean === '') {
      window.localStorage.removeItem(STORAGE_KEY_API_URL);
    } else {
      window.localStorage.setItem(STORAGE_KEY_API_URL, clean);
    }
  }
}

export function buildApiUrl(path: string): string {
  const base = getDefaultApiBaseUrl().replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.detail) {
        message = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      const txt = await res.text();
      if (txt) message = txt;
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () =>
    requestJson<{
      status: string;
      backend: string;
      sdv_available: boolean;
      sdv_version: string | null;
      has_trained_model: boolean;
      active_model: Record<string, unknown> | null;
    }>('/api/health'),

  getDatasetPreview: (datasetId?: string, limit = 25) => {
    const params = new URLSearchParams();
    if (datasetId) params.set('dataset_id', datasetId);
    params.set('limit', String(limit));
    return requestJson<DatasetPreviewResponse>(`/api/dataset/preview?${params.toString()}`);
  },

  uploadDataset: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestJson<{ status: string; dataset: DatasetRecord }>('/api/dataset/upload', {
      method: 'POST',
      body: form,
    });
  },

  cleanDataset: (payload: {
    dataset_id?: string;
    drop_duplicates: boolean;
    fill_missing: boolean;
    normalize_categories: boolean;
    enforce_types: boolean;
    selected_features?: string[];
  }) =>
    requestJson<DatasetCleanResponse>('/api/dataset/clean', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  selectDataset: (datasetId: string) =>
    requestJson<{ status: string; dataset: DatasetRecord }>(`/api/dataset/select/${encodeURIComponent(datasetId)}`, {
      method: 'POST',
    }),

  listDatasets: () =>
    requestJson<{
      datasets: DatasetRecord[];
      active_raw_dataset_id: string | null;
      active_cleaned_dataset_id: string | null;
      active_synthetic_dataset_id: string | null;
    }>('/api/dataset/list'),

  getModelStatus: () => requestJson<ModelStatusResponse>('/api/model/status'),

  trainModel: (payload: {
    dataset_id?: string;
    model_type: 'CTGANSynthesizer' | 'GaussianCopulaSynthesizer';
    epochs: number;
    batch_size: number;
    random_seed: number | null;
  }) =>
    requestJson<ModelTrainResponse>('/api/model/train', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateSynthetic: (payload: {
    model_id?: string;
    num_records: number;
    random_seed: number | null;
    customer_segment?: string | null;
    channel?: string | null;
  }) =>
    requestJson<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getGenerationHistory: () =>
    requestJson<{ history: GenerationHistoryRecord[] }>('/api/generate/history'),

  validateSynthetic: (payload: {
    synthetic_dataset_id?: string;
    reference_dataset_id?: string;
  }) =>
    requestJson<ValidationReport>('/api/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLatestValidation: (syntheticDatasetId?: string) => {
    const params = syntheticDatasetId ? `?synthetic_dataset_id=${encodeURIComponent(syntheticDatasetId)}` : '';
    return requestJson<{ has_report: boolean; report: ValidationReport | null }>(`/api/validate/latest${params}`);
  },

  getOverviewMetrics: (datasetId?: string) => {
    const params = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return requestJson<OverviewMetrics>(`/api/analytics/overview${params}`);
  },

  getChannelAnalytics: (datasetId?: string) => {
    const params = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return requestJson<ChannelAnalyticsResponse>(`/api/analytics/channels${params}`);
  },

  getChannelTransitions: (datasetId?: string) => {
    const params = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return requestJson<ChannelTransitionsResponse>(`/api/analytics/transitions${params}`);
  },

  listCustomers: (datasetId?: string, search?: string) => {
    const params = new URLSearchParams();
    if (datasetId) params.set('dataset_id', datasetId);
    if (search) params.set('search', search);
    return requestJson<{ dataset: DatasetRecord; total_customers: number; customers: CustomerSummary[] }>(
      `/api/analytics/customers?${params.toString()}`
    );
  },

  getCustomerTimeline: (customerId: string, datasetId?: string) => {
    const params = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return requestJson<CustomerTimelineResponse>(
      `/api/analytics/customers/${encodeURIComponent(customerId)}${params}`
    );
  },

  trainPersonalization: (payload: {
    dataset_id?: string;
    model_name: string;
    test_size: number;
    random_seed: number;
  }) =>
    requestJson<PersonalizationTrainResponse>('/api/model-testing/train', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  predictPersonalization: (payload: {
    previous_interaction_type: string;
    channel: string;
    customer_segment: string;
    journey_stage: string;
    previous_interactions_count: number;
    previous_purchase_amount: number;
    interaction_duration: number;
  }) =>
    requestJson<PersonalizationPredictResponse>('/api/model-testing/predict', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getExportUrl: (datasetId: string) => buildApiUrl(`/api/export/${encodeURIComponent(datasetId)}`),

  // Authentication
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await requestJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  register: async (email: string, fullName: string, password: string): Promise<AuthResponse> => {
    const res = await requestJson<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, full_name: fullName, password }),
    });
    if (res?.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  demoLogin: async (): Promise<AuthResponse> => {
    const res = await requestJson<AuthResponse>('/api/auth/demo-login', {
      method: 'POST',
    });
    if (res?.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  getMe: (): Promise<User> => requestJson<User>('/api/auth/me'),

  logout: async (): Promise<void> => {
    try {
      await requestJson<{ message: string }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
    }
  },

  rawRequest: async (method: string, path: string, body?: string) => {
    const init: RequestInit = { method };
    if (body && method !== 'GET') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = body;
    }
    const res = await fetch(buildApiUrl(path), init);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { status: res.status, ok: res.ok, data: parsed };
  },
};
