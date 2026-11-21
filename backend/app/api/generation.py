from fastapi import APIRouter, HTTPException

from app.database import list_generation_history
from app.schemas.generation import (
    GenerateRequest,
    GenerateResponse,
    ModelStatusResponse,
    ModelTrainRequest,
    ModelTrainResponse,
)
from app.services.sdv_generator import (
    generate_synthetic_journeys,
    get_model_status_summary,
    train_sdv_model,
)

router = APIRouter(tags=["SDV Model & Synthetic Generation"])


@router.post("/api/model/train", response_model=ModelTrainResponse)
def train_model(payload: ModelTrainRequest):
    try:
        return train_sdv_model(
            dataset_id=payload.dataset_id,
            model_type=payload.model_type,
            epochs=payload.epochs,
            batch_size=payload.batch_size,
            random_seed=payload.random_seed,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model training failed: {exc}") from exc


@router.get("/api/model/status", response_model=ModelStatusResponse)
def model_status():
    return get_model_status_summary()


@router.post("/api/generate", response_model=GenerateResponse)
def generate_data(payload: GenerateRequest):
    try:
        return generate_synthetic_journeys(
            model_id=payload.model_id,
            num_records=payload.num_records,
            random_seed=payload.random_seed,
            customer_segment=payload.customer_segment,
            channel=payload.channel,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Synthetic generation failed: {exc}") from exc


@router.get("/api/generate/history")
def generation_history():
    return {"history": list_generation_history()}
