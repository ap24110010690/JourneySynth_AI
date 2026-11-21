from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.database import get_dataset_record, get_state, list_datasets, set_state
from app.schemas.dataset import DatasetCleanRequest, DatasetCleanResponse, DatasetPreviewResponse
from app.services.data_preprocessing import (
    build_dataset_preview,
    clean_dataset_with_pandas,
    save_uploaded_dataset,
)

router = APIRouter(tags=["Dataset Preparation"])


@router.post("/api/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv dataset files are supported.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")
    try:
        record = save_uploaded_dataset(file.filename, content)
        return {"status": "uploaded", "dataset": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/dataset/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=5, le=200),
):
    try:
        return build_dataset_preview(dataset_id=dataset_id, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/dataset/clean", response_model=DatasetCleanResponse)
def clean_dataset(payload: DatasetCleanRequest):
    try:
        return clean_dataset_with_pandas(
            dataset_id=payload.dataset_id,
            drop_duplicates=payload.drop_duplicates,
            fill_missing=payload.fill_missing,
            normalize_categories=payload.normalize_categories,
            enforce_types=payload.enforce_types,
            selected_features=payload.selected_features,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/dataset/select/{dataset_id}")
def select_active_dataset(dataset_id: str):
    rec = get_dataset_record(dataset_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    if rec["source_type"] == "synthetic":
        set_state("active_synthetic_dataset_id", dataset_id)
    elif rec["is_cleaned"]:
        set_state("active_cleaned_dataset_id", dataset_id)
    else:
        set_state("active_raw_dataset_id", dataset_id)
    return {"status": "selected", "dataset": rec}


@router.get("/api/dataset/list")
def get_all_datasets():
    return {
        "datasets": list_datasets(),
        "active_raw_dataset_id": get_state("active_raw_dataset_id"),
        "active_cleaned_dataset_id": get_state("active_cleaned_dataset_id"),
        "active_synthetic_dataset_id": get_state("active_synthetic_dataset_id"),
    }


@router.get("/api/export/{dataset_id}")
def export_dataset_csv(dataset_id: str):
    rec = get_dataset_record(dataset_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    file_path = Path(rec["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset CSV file not found on disk.")
    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=f"{dataset_id}.csv",
    )
