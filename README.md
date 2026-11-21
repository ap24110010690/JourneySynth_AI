# JourneySynth AI — Synthetic Omnichannel Customer Journey Generator

**Generate. Validate. Understand.**

JourneySynth AI is an end-to-end synthetic data engineering and omnichannel analytics platform powered by **Synthetic Data Vault (SDV)**, **Pandas**, **SDMetrics**, **Scikit-learn**, **FastAPI**, and **React + TypeScript**.

## Architecture

- **Backend (`backend/`)**: Python 3.10+, FastAPI, Uvicorn, Pydantic, Pandas, SDV (`CTGANSynthesizer`, `GaussianCopulaSynthesizer`, `SingleTableMetadata`), SDMetrics (`QualityReport`), Scikit-learn, SQLite metadata store, and CSV exports.
- **Frontend (`frontend/`)**: React 19, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts.
- **AI Studio Preview Entry (`server.ts` + `src/`)**: Automatically launches Uvicorn on port `8000`, proxies `/api/*` and `/docs` cleanly, and serves Vite on port `3000`.

## Evaluation Criteria & Module Mapping

| Criterion (Weight) | Implementation Module |
| :--- | :--- |
| **Customer Journey Data Preparation (15%)** | `backend/app/services/sample_data_builder.py` (1,200+ record built-in dataset), `data_preprocessing.py` (Pandas missing value imputation, duplicate removal, dtype enforcement, category normalization, schema inspection), `DatasetPreparation.tsx` |
| **Synthetic Journey Model Implementation (25%)** | `backend/app/services/sdv_generator.py` (`SingleTableMetadata`, `CTGANSynthesizer`, `GaussianCopulaSynthesizer`, conditional sampling, `.pkl` persistence, sequence diagnostics), `SyntheticGeneration.tsx` |
| **Synthetic Journey Data Quality (20%)** | `backend/app/services/data_validation.py` (`SDMetrics QualityReport`, Completeness, Consistency, Uniqueness, mean/std checks, transition & sequence validation, statistical similarity vs privacy disclaimer), `DataValidation.tsx` |
| **Omnichannel Journey Analysis (15%)** | `backend/app/services/journey_analysis.py` (Pandas channel shares, funnels, transitions, daily trends, segment behavior, chronological customer timelines), `JourneyAnalytics.tsx`, `CustomerExplorer.tsx` |
| **FastAPI Integration & Testing (10%)** | `backend/app/main.py` & `backend/app/api/*.py` (15 Pydantic-validated REST endpoints, SQLite persistence, Swagger UI `/docs`), `backend/app/tests/*.py` |
| **Authentication & User Management** | `backend/app/api/auth.py`, `backend/app/services/auth_service.py` (PBKDF2-SHA256 hashed passwords, 16-byte cryptographic salt, 30-day session tokens), `AuthPage.tsx` (Sign In / New User Registration / 1-Click Demo Login) |
| **Documentation & Final Demo (15%)** | 10 functional SaaS pages including `ModelTesting.tsx` (leak-free `GroupShuffleSplit` Scikit-learn conversion demo), `APIDocumentation.tsx`, `GenerationHistory.tsx`, and this `README.md` |

## Authentication & New User Registration

JourneySynth AI features a full-fledged authentication system with cryptographic password hashing (PBKDF2 with SHA-256 and 100,000 rounds), per-user salts, persistent session tokens stored in SQLite, and an interactive dual-tab UI:

- **Register New User**: Allows new team members or analysts to register with Full Name, Email, and Password (with real-time password strength and match verification).
- **Sign In**: Secure login with email and password, returning a 30-day bearer session token.
- **One-Click Demo Login**: Pre-seeded demo account for rapid evaluation without manual typing.
  - **Email**: `demo@journeysynth.ai`
  - **Password**: `demo123`
- **Session Management**: Persistent bearer token header attached to all requests, user badge in navigation header and sidebar, and clean instant logout.

## Local Two-Terminal Execution (Windows & macOS/Linux)

### Terminal 1 — FastAPI Backend (`http://127.0.0.1:8000`)

```bash
cd backend
python -m venv venv
```

Activate virtual environment:
- **Windows (CMD/PowerShell)**: `venv\Scripts\activate`
- **macOS/Linux**: `source venv/bin/activate`

Install dependencies and start FastAPI:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Interactive Swagger API documentation is available at:
`http://127.0.0.1:8000/docs`

### Terminal 2 — React + Vite Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (default `http://localhost:5173`). The frontend automatically connects to `http://127.0.0.1:8000` (configurable in **Settings**).

## Running Automated Backend Tests

```bash
cd backend
pytest app/tests -v
```
