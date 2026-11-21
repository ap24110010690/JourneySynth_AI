from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, auth, dataset, generation, model_testing, validation
from app.database import init_db
from app.services.auth_service import ensure_demo_user
from app.services.data_preprocessing import ensure_sample_dataset_registered
from app.services.sdv_generator import get_model_status_summary


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_demo_user()
    ensure_sample_dataset_registered()
    yield


app = FastAPI(
    title="JourneySynth AI API",
    description="Synthetic Omnichannel Customer Journey Generator powered by SDV, Pandas, SDMetrics, and Scikit-learn.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dataset.router)
app.include_router(generation.router)
app.include_router(validation.router)
app.include_router(analytics.router)
app.include_router(model_testing.router)


@app.get("/", tags=["Health"])
def root_health():
    return {
        "service": "JourneySynth AI",
        "status": "healthy",
        "docs_url": "/docs",
    }


@app.get("/api/health", tags=["Health"])
def api_health():
    model_summary = get_model_status_summary()
    return {
        "status": "ok",
        "backend": "FastAPI",
        "sdv_available": model_summary["sdv_available"],
        "sdv_version": model_summary["sdv_version"],
        "has_trained_model": model_summary["has_trained_model"],
        "active_model": model_summary["active_model"],
    }
