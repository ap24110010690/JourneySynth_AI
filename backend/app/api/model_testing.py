from fastapi import APIRouter, HTTPException

from app.schemas.validation import PersonalizationPredictRequest, PersonalizationTrainRequest
from app.services.personalization import predict_sample_interaction, train_personalization_model

router = APIRouter(tags=["Personalization Model Testing"])


@router.post("/api/model-testing/train")
def train_personalization(payload: PersonalizationTrainRequest):
    try:
        return train_personalization_model(
            dataset_id=payload.dataset_id,
            model_name=payload.model_name,
            test_size=payload.test_size,
            random_seed=payload.random_seed,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/model-testing/predict")
def predict_personalization(payload: PersonalizationPredictRequest):
    try:
        return predict_sample_interaction(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
