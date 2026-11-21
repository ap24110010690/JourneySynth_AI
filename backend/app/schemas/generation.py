from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ModelTrainRequest(BaseModel):
    dataset_id: Optional[str] = None
    model_type: Literal["CTGANSynthesizer", "GaussianCopulaSynthesizer"] = "CTGANSynthesizer"
    epochs: int = Field(default=30, ge=5, le=500)
    batch_size: int = Field(default=100, ge=20, le=1000)
    random_seed: Optional[int] = 42


class ModelTrainResponse(BaseModel):
    model_id: str
    model_type: str
    dataset_id: str
    status: str
    epochs: int
    batch_size: int
    random_seed: Optional[int]
    training_duration_sec: float
    row_count_trained: int
    metadata_columns: Dict[str, Any]
    model_path: str
    metadata_path: str
    note: str


class ModelStatusResponse(BaseModel):
    is_training: bool
    has_trained_model: bool
    active_model: Optional[Dict[str, Any]] = None
    trained_models: List[Dict[str, Any]] = []
    sdv_available: bool = True
    sdv_version: Optional[str] = None


class GenerateRequest(BaseModel):
    model_id: Optional[str] = None
    num_records: int = Field(default=500, ge=10, le=20000)
    random_seed: Optional[int] = 42
    customer_segment: Optional[str] = None
    channel: Optional[str] = None


class GenerateResponse(BaseModel):
    generation_id: str
    dataset_id: str
    model_id: str
    model_type: str
    num_records: int
    customer_count: int
    random_seed: Optional[int]
    customer_segment_filter: Optional[str]
    channel_filter: Optional[str]
    file_path: str
    duration_sec: float
    sequence_validation_note: str
    sequence_diagnostics: Dict[str, Any]
    preview_rows: List[Dict[str, Any]]
