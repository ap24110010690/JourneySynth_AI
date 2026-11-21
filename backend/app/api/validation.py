from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import get_latest_validation_report
from app.schemas.validation import ValidateRequest
from app.services.data_validation import validate_synthetic_dataset

router = APIRouter(tags=["Data Quality Validation"])


@router.post("/api/validate")
def run_validation(payload: ValidateRequest):
    try:
        return validate_synthetic_dataset(
            synthetic_dataset_id=payload.synthetic_dataset_id,
            reference_dataset_id=payload.reference_dataset_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Validation failed: {exc}") from exc


@router.get("/api/validate/latest")
def get_latest_validation(synthetic_dataset_id: Optional[str] = Query(default=None)):
    report = get_latest_validation_report(synthetic_dataset_id=synthetic_dataset_id)
    if not report:
        return {"has_report": False, "report": None}
    return {"has_report": True, **report}
