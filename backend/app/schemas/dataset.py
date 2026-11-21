from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ColumnSchemaInfo(BaseModel):
    column: str
    dtype: str
    sdtype: str
    null_count: int
    null_pct: float
    unique_count: int
    sample_values: List[Any]


class DatasetPreviewResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    source_type: str
    is_cleaned: bool
    row_count: int
    column_count: int
    customer_count: int
    duplicate_rows: int
    total_missing_values: int
    columns: List[ColumnSchemaInfo]
    preview_rows: List[Dict[str, Any]]
    available_datasets: List[Dict[str, Any]]


class DatasetCleanRequest(BaseModel):
    dataset_id: Optional[str] = None
    drop_duplicates: bool = True
    fill_missing: bool = True
    normalize_categories: bool = True
    enforce_types: bool = True
    selected_features: Optional[List[str]] = None


class DatasetCleanResponse(BaseModel):
    cleaned_dataset_id: str
    source_dataset_id: str
    file_path: str
    original_rows: int
    cleaned_rows: int
    duplicates_removed: int
    missing_values_before: int
    missing_values_after: int
    invalid_values_fixed: int
    consistency_issues_fixed: int
    operations_applied: List[str]
    preview_rows: List[Dict[str, Any]]
