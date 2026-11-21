# JourneySynth AI — FastAPI + SDV Backend

## Setup & Execution

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Key Endpoints

- `GET /` — Root health check
- `GET /api/health` — Backend and SDV readiness
- `POST /api/dataset/upload` — Upload CSV dataset
- `GET /api/dataset/preview` — Preview records and inferred schema
- `POST /api/dataset/clean` — Run Pandas preprocessing pipeline
- `POST /api/model/train` — Train `CTGANSynthesizer` or `GaussianCopulaSynthesizer`
- `GET /api/model/status` — Inspect trained SDV synthesizers
- `POST /api/generate` — Sample synthetic omnichannel records
- `GET /api/generate/history` — SQLite generation audit log
- `POST /api/validate` — Run SDMetrics `QualityReport` + sequence validation
- `GET /api/analytics/overview` — Dashboard KPIs
- `GET /api/analytics/channels` — Channel distributions, funnel, daily trends, segments
- `GET /api/analytics/transitions` — Cross-channel transition frequencies
- `GET /api/analytics/customers/{customer_id}` — Chronological customer journey timeline
- `GET /api/export/{dataset_id}` — Download CSV dataset

## Testing

```bash
pytest app/tests -v
```
