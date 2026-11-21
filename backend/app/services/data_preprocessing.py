import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.config import (
    ALLOWED_CHANNELS,
    ALLOWED_INTERACTION_TYPES,
    ALLOWED_JOURNEY_STAGES,
    ALLOWED_SEGMENTS,
    CLEANED_DIR,
    REQUIRED_COLUMNS,
    SAMPLE_DATASET_PATH,
    UPLOADED_DIR,
)
from app.database import (
    get_dataset_record,
    get_state,
    list_datasets,
    register_dataset,
    set_state,
)
from app.services.sample_data_builder import generate_sample_dataset

CHANNEL_ALIASES = {
    "web": "Website",
    "website": "Website",
    "site": "Website",
    "mobile app": "Mobile Application",
    "mobile application": "Mobile Application",
    "app": "Mobile Application",
    "email": "Email",
    "e-mail": "Email",
    "store": "Physical Store",
    "physical store": "Physical Store",
    "in-store": "Physical Store",
    "social": "Social Media",
    "social media": "Social Media",
    "support": "Customer Support",
    "customer support": "Customer Support",
}

INTERACTION_ALIASES = {item.lower(): item for item in ALLOWED_INTERACTION_TYPES}
STAGE_ALIASES = {item.lower(): item for item in ALLOWED_JOURNEY_STAGES}
SEGMENT_ALIASES = {item.lower(): item for item in ALLOWED_SEGMENTS}


def ensure_sample_dataset_registered() -> Dict[str, Any]:
    """Ensure sample CSV exists on disk and is registered in SQLite."""
    if not SAMPLE_DATASET_PATH.exists():
        generate_sample_dataset(SAMPLE_DATASET_PATH)

    existing = get_dataset_record("sample-default")
    if existing and Path(existing["file_path"]).exists():
        if not get_state("active_raw_dataset_id"):
            set_state("active_raw_dataset_id", "sample-default")
        return existing

    df = pd.read_csv(SAMPLE_DATASET_PATH)
    record = register_dataset(
        dataset_id="sample-default",
        name="sample_journey_data.csv (Built-in Omnichannel Sample)",
        source_type="sample",
        file_path=str(SAMPLE_DATASET_PATH),
        row_count=int(len(df)),
        customer_count=int(df["customer_id"].nunique()) if "customer_id" in df.columns else 0,
        is_cleaned=False,
    )
    if not get_state("active_raw_dataset_id"):
        set_state("active_raw_dataset_id", "sample-default")
    return record


def resolve_dataset_path(dataset_id: Optional[str] = None, prefer_cleaned: bool = False) -> Tuple[Dict[str, Any], pd.DataFrame]:
    """Load the requested or active dataset as a Pandas DataFrame."""
    ensure_sample_dataset_registered()

    resolved_id = dataset_id
    if not resolved_id:
        if prefer_cleaned:
            resolved_id = get_state("active_cleaned_dataset_id") or get_state("active_raw_dataset_id") or "sample-default"
        else:
            resolved_id = get_state("active_raw_dataset_id") or "sample-default"

    record = get_dataset_record(resolved_id)
    if not record or not Path(record["file_path"]).exists():
        record = get_dataset_record("sample-default")
        if not record:
            record = ensure_sample_dataset_registered()

    df = pd.read_csv(record["file_path"])
    return record, df


def infer_sdtype(series: pd.Series, col_name: str) -> str:
    if col_name == "interaction_id":
        return "id (primary_key)"
    if col_name == "timestamp":
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numerical"
    return "categorical"


def build_dataset_preview(dataset_id: Optional[str] = None, limit: int = 25) -> Dict[str, Any]:
    record, df = resolve_dataset_path(dataset_id=dataset_id, prefer_cleaned=False)

    columns_info: List[Dict[str, Any]] = []
    for col in df.columns:
        s = df[col]
        null_count = int(s.isna().sum())
        samples = [
            None if pd.isna(v) else (float(v) if isinstance(v, (np.floating,)) else int(v) if isinstance(v, (np.integer,)) else str(v))
            for v in s.dropna().head(3).tolist()
        ]
        columns_info.append(
            {
                "column": str(col),
                "dtype": str(s.dtype),
                "sdtype": infer_sdtype(s, str(col)),
                "null_count": null_count,
                "null_pct": round((null_count / max(len(df), 1)) * 100.0, 2),
                "unique_count": int(s.nunique(dropna=True)),
                "sample_values": samples,
            }
        )

    preview_df = df.head(limit).copy()
    preview_rows = preview_df.replace({np.nan: None}).to_dict(orient="records")

    return {
        "dataset_id": record["id"],
        "dataset_name": record["name"],
        "source_type": record["source_type"],
        "is_cleaned": record["is_cleaned"],
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "customer_count": int(df["customer_id"].nunique()) if "customer_id" in df.columns else 0,
        "duplicate_rows": int(df.duplicated().sum()),
        "total_missing_values": int(df.isna().sum().sum()),
        "columns": columns_info,
        "preview_rows": preview_rows,
        "available_datasets": list_datasets(),
    }


def save_uploaded_dataset(filename: str, content_bytes: bytes) -> Dict[str, Any]:
    """Validate and save an uploaded CSV dataset."""
    ensure_sample_dataset_registered()
    dataset_id = f"upload-{uuid.uuid4().hex[:8]}"
    safe_name = Path(filename).name.replace(" ", "_")
    target_path = UPLOADED_DIR / f"{dataset_id}_{safe_name}"
    target_path.write_bytes(content_bytes)

    try:
        df = pd.read_csv(target_path)
    except Exception as exc:
        target_path.unlink(missing_ok=True)
        raise ValueError(f"Could not parse CSV file: {exc}") from exc

    if df.empty:
        target_path.unlink(missing_ok=True)
        raise ValueError("Uploaded CSV dataset is empty.")

    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        target_path.unlink(missing_ok=True)
        raise ValueError(
            f"Uploaded CSV is missing required omnichannel columns: {', '.join(missing_cols)}"
        )

    record = register_dataset(
        dataset_id=dataset_id,
        name=safe_name,
        source_type="uploaded",
        file_path=str(target_path),
        row_count=int(len(df)),
        customer_count=int(df["customer_id"].nunique()),
        is_cleaned=False,
    )
    set_state("active_raw_dataset_id", dataset_id)
    return record


def clean_dataset_with_pandas(
    dataset_id: Optional[str] = None,
    drop_duplicates: bool = True,
    fill_missing: bool = True,
    normalize_categories: bool = True,
    enforce_types: bool = True,
    selected_features: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Execute full Pandas preprocessing pipeline on raw dataset."""
    record, df = resolve_dataset_path(dataset_id=dataset_id, prefer_cleaned=False)
    df = df.copy()

    original_rows = int(len(df))
    missing_before = int(df.isna().sum().sum())
    duplicates_removed = 0
    invalid_values_fixed = 0
    consistency_issues_fixed = 0
    operations: List[str] = []

    # 1. Duplicate removal
    if drop_duplicates:
        before_dup = len(df)
        df = df.drop_duplicates()
        if "interaction_id" in df.columns:
            df = df.drop_duplicates(subset=["interaction_id"], keep="first")
        duplicates_removed = int(before_dup - len(df))
        operations.append(f"Removed {duplicates_removed} duplicate interaction records")

    # 2. Category normalization & whitespace cleanup
    if normalize_categories:
        for col in df.select_dtypes(include=["object", "string"]).columns:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

        if "channel" in df.columns:
            def norm_channel(val: Any) -> Any:
                if pd.isna(val):
                    return val
                key = str(val).strip().lower()
                return CHANNEL_ALIASES.get(key, str(val).strip())

            before_ch = df["channel"].copy()
            df["channel"] = df["channel"].apply(norm_channel)
            changed = int((before_ch.fillna("") != df["channel"].fillna("")).sum())
            invalid_values_fixed += changed

        if "interaction_type" in df.columns:
            def norm_int(val: Any) -> Any:
                if pd.isna(val):
                    return val
                key = str(val).strip().lower()
                return INTERACTION_ALIASES.get(key, str(val).strip())

            before_it = df["interaction_type"].copy()
            df["interaction_type"] = df["interaction_type"].apply(norm_int)
            invalid_values_fixed += int((before_it.fillna("") != df["interaction_type"].fillna("")).sum())

        if "journey_stage" in df.columns:
            df["journey_stage"] = df["journey_stage"].apply(
                lambda v: STAGE_ALIASES.get(str(v).strip().lower(), str(v).strip()) if pd.notna(v) else v
            )

        if "customer_segment" in df.columns:
            df["customer_segment"] = df["customer_segment"].apply(
                lambda v: SEGMENT_ALIASES.get(str(v).strip().lower(), str(v).strip()) if pd.notna(v) else v
            )

        operations.append("Normalized categorical labels and stripped whitespace")

    # 3. Data type conversion & timestamp formatting
    if enforce_types:
        if "timestamp" in df.columns:
            parsed_ts = pd.to_datetime(df["timestamp"], errors="coerce")
            invalid_ts = int(parsed_ts.isna().sum())
            if invalid_ts > 0:
                parsed_ts = parsed_ts.ffill().bfill()
                invalid_values_fixed += invalid_ts
            df["timestamp"] = parsed_ts.dt.strftime("%Y-%m-%d %H:%M:%S")

        for num_col in ["interaction_duration", "purchase_amount"]:
            if num_col in df.columns:
                df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
                neg_mask = df[num_col] < 0
                if neg_mask.any():
                    invalid_values_fixed += int(neg_mask.sum())
                    median_pos = float(df.loc[df[num_col] >= 0, num_col].median()) if (df[num_col] >= 0).any() else 60.0
                    df.loc[neg_mask, num_col] = round(median_pos, 2)

        operations.append("Enforced numeric dtypes, corrected negative durations, and standardized ISO timestamps")

    # 4. Missing value handling
    if fill_missing:
        for col in df.columns:
            if df[col].isna().any():
                if pd.api.types.is_numeric_dtype(df[col]):
                    fill_val = float(df[col].median()) if not df[col].dropna().empty else 0.0
                    df[col] = df[col].fillna(round(fill_val, 2))
                else:
                    mode_vals = df[col].mode(dropna=True)
                    fill_val = str(mode_vals.iloc[0]) if not mode_vals.empty else "Unknown"
                    df[col] = df[col].fillna(fill_val)
        operations.append("Imputed missing categorical values with mode and numerical values with median")

    # 5. Consistency checks (Purchase <-> purchase_amount & conversion_status)
    if all(c in df.columns for c in ["interaction_type", "purchase_amount", "conversion_status"]):
        non_purchase_with_amount = (df["interaction_type"] != "Purchase") & (df["purchase_amount"] > 0)
        if non_purchase_with_amount.any():
            consistency_issues_fixed += int(non_purchase_with_amount.sum())
            df.loc[non_purchase_with_amount, "purchase_amount"] = 0.0

        purchase_without_amount = (df["interaction_type"] == "Purchase") & (df["purchase_amount"] <= 0)
        if purchase_without_amount.any():
            consistency_issues_fixed += int(purchase_without_amount.sum())
            avg_purchase = float(df.loc[df["purchase_amount"] > 0, "purchase_amount"].median() or 85.0)
            df.loc[purchase_without_amount, "purchase_amount"] = round(avg_purchase, 2)
            df.loc[purchase_without_amount, "conversion_status"] = "Converted"

        operations.append("Verified purchase amount & conversion status domain consistency")

    # 6. Feature selection (always retain required core IDs if specified)
    if selected_features:
        valid_cols = [c for c in selected_features if c in df.columns]
        if valid_cols:
            df = df[valid_cols]
            operations.append(f"Selected {len(valid_cols)} features for downstream modeling")

    # Sort chronologically for clean inspection
    if "customer_id" in df.columns and "timestamp" in df.columns:
        df = df.sort_values(["timestamp", "customer_id"]).reset_index(drop=True)

    cleaned_id = f"cleaned-{uuid.uuid4().hex[:8]}"
    cleaned_path = CLEANED_DIR / f"{cleaned_id}.csv"
    df.to_csv(cleaned_path, index=False)

    register_dataset(
        dataset_id=cleaned_id,
        name=f"Cleaned: {record['name']}",
        source_type="cleaned",
        file_path=str(cleaned_path),
        row_count=int(len(df)),
        customer_count=int(df["customer_id"].nunique()) if "customer_id" in df.columns else 0,
        is_cleaned=True,
        parent_dataset_id=record["id"],
    )
    set_state("active_cleaned_dataset_id", cleaned_id)

    missing_after = int(df.isna().sum().sum())
    preview_rows = df.head(25).replace({np.nan: None}).to_dict(orient="records")

    return {
        "cleaned_dataset_id": cleaned_id,
        "source_dataset_id": record["id"],
        "file_path": str(cleaned_path),
        "original_rows": original_rows,
        "cleaned_rows": int(len(df)),
        "duplicates_removed": duplicates_removed,
        "missing_values_before": missing_before,
        "missing_values_after": missing_after,
        "invalid_values_fixed": invalid_values_fixed,
        "consistency_issues_fixed": consistency_issues_fixed,
        "operations_applied": operations,
        "preview_rows": preview_rows,
    }
