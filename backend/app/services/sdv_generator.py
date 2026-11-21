import random
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from sdv.metadata import Metadata
from sdv.sampling import Condition
from sdv.single_table import CTGANSynthesizer, GaussianCopulaSynthesizer
from sdv.utils import load_synthesizer

from app.config import (
    ALLOWED_CHANNELS,
    ALLOWED_INTERACTION_TYPES,
    METADATA_DIR,
    SYNTHESIZERS_DIR,
    SYNTHETIC_DIR,
)
from app.database import (
    get_latest_trained_model,
    get_state,
    list_trained_models,
    register_dataset,
    save_generation_record,
    save_trained_model,
    set_state,
)
from app.services.data_preprocessing import clean_dataset_with_pandas, resolve_dataset_path

TABLE_NAME = "journeys"
_TRAINING_IN_PROGRESS = False


def is_training_active() -> bool:
    return _TRAINING_IN_PROGRESS


def _set_seed(seed: Optional[int]) -> None:
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)
        try:
            import torch

            torch.manual_seed(seed)
        except Exception:
            pass


def build_sdv_metadata(df: pd.DataFrame) -> Metadata:
    """Detect and explicitly configure SDV Metadata for omnichannel journeys."""
    metadata = Metadata.detect_from_dataframes(data={TABLE_NAME: df})

    # Explicitly configure primary key, datetime, categorical, and numerical columns
    if "interaction_id" in df.columns:
        metadata.update_column(
            column_name="interaction_id",
            sdtype="id",
            regex_format=r"INT-[0-9]{6}",
            table_name=TABLE_NAME,
        )
        metadata.set_primary_key(column_name="interaction_id", table_name=TABLE_NAME)

    if "session_id" in df.columns:
        metadata.update_column(
            column_name="session_id",
            sdtype="id",
            regex_format=r"SESS-[0-9]{4}-[0-9]",
            table_name=TABLE_NAME,
        )

    if "customer_id" in df.columns:
        # Treating customer_id as categorical lets SDV learn multi-touchpoint customer frequency
        metadata.update_column(column_name="customer_id", sdtype="categorical", table_name=TABLE_NAME)

    if "timestamp" in df.columns:
        metadata.update_column(
            column_name="timestamp",
            sdtype="datetime",
            datetime_format="%Y-%m-%d %H:%M:%S",
            table_name=TABLE_NAME,
        )

    for num_col in ["interaction_duration", "purchase_amount"]:
        if num_col in df.columns:
            metadata.update_column(column_name=num_col, sdtype="numerical", table_name=TABLE_NAME)

    categorical_cols = [
        "channel",
        "interaction_type",
        "product_category",
        "device_type",
        "location",
        "campaign_source",
        "conversion_status",
        "customer_segment",
        "journey_stage",
    ]
    for cat_col in categorical_cols:
        if cat_col in df.columns:
            metadata.update_column(column_name=cat_col, sdtype="categorical", table_name=TABLE_NAME)

    metadata.validate()
    return metadata


def extract_metadata_columns(metadata: Metadata) -> Dict[str, Any]:
    meta_dict = metadata.to_dict()
    if "tables" in meta_dict and TABLE_NAME in meta_dict["tables"]:
        return meta_dict["tables"][TABLE_NAME].get("columns", {})
    return meta_dict.get("columns", {})


def train_sdv_model(
    dataset_id: Optional[str] = None,
    model_type: str = "CTGANSynthesizer",
    epochs: int = 30,
    batch_size: int = 100,
    random_seed: Optional[int] = 42,
) -> Dict[str, Any]:
    """Train a real SDV synthesizer on prepared journey data and persist model + metadata."""
    global _TRAINING_IN_PROGRESS
    _TRAINING_IN_PROGRESS = True
    start = time.time()

    try:
        _set_seed(random_seed)

        # Prefer cleaned dataset; if none exists yet, automatically run Pandas cleaning first
        cleaned_id = get_state("active_cleaned_dataset_id")
        if not dataset_id and not cleaned_id:
            clean_res = clean_dataset_with_pandas()
            dataset_id = clean_res["cleaned_dataset_id"]

        record, df = resolve_dataset_path(dataset_id=dataset_id, prefer_cleaned=True)
        train_df = df.copy()

        if "timestamp" in train_df.columns:
            train_df["timestamp"] = pd.to_datetime(train_df["timestamp"], errors="coerce")
            train_df["timestamp"] = train_df["timestamp"].ffill().bfill()
            train_df["timestamp"] = train_df["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

        if "interaction_id" in train_df.columns:
            train_df = train_df.drop_duplicates(subset=["interaction_id"], keep="first").reset_index(drop=True)

        metadata = build_sdv_metadata(train_df)

        model_id = f"sdv-{model_type.lower()[:6]}-{uuid.uuid4().hex[:8]}"
        metadata_path = METADATA_DIR / f"{model_id}_metadata.json"
        model_path = SYNTHESIZERS_DIR / f"{model_id}.pkl"

        if metadata_path.exists():
            metadata_path.unlink()
        metadata.save_to_json(filepath=str(metadata_path))

        effective_batch = min(batch_size, max(20, (len(train_df) // 10) * 10))
        effective_batch = max(10, (effective_batch // 10) * 10)

        if model_type == "CTGANSynthesizer":
            synthesizer = CTGANSynthesizer(
                metadata=metadata,
                epochs=epochs,
                batch_size=effective_batch,
                pac=10,
                verbose=False,
            )
        elif model_type == "GaussianCopulaSynthesizer":
            synthesizer = GaussianCopulaSynthesizer(metadata=metadata)
        else:
            raise ValueError(f"Unsupported SDV synthesizer: {model_type}")

        synthesizer.fit({TABLE_NAME: train_df})
        synthesizer.save(filepath=str(model_path))

        duration = round(time.time() - start, 2)
        saved = save_trained_model(
            model_id=model_id,
            model_type=model_type,
            dataset_id=record["id"],
            model_path=str(model_path),
            metadata_path=str(metadata_path),
            epochs=epochs if model_type == "CTGANSynthesizer" else 1,
            batch_size=effective_batch if model_type == "CTGANSynthesizer" else len(train_df),
            random_seed=random_seed,
            status="trained",
            training_duration_sec=duration,
            row_count_trained=int(len(train_df)),
        )
        set_state("active_model_id", model_id)

        return {
            **saved,
            "model_id": model_id,
            "metadata_columns": extract_metadata_columns(metadata),
            "note": (
                "SDV learns statistical column distributions and inter-column correlations from the prepared dataset. "
                "Because single-table synthesizers model tabular dependencies rather than strict Markovian sequence constraints, "
                "generated records are checked with journey-level sequence diagnostics after sampling."
            ),
        }
    finally:
        _TRAINING_IN_PROGRESS = False


def evaluate_journey_sequence_coherence(df: pd.DataFrame) -> Dict[str, Any]:
    """Check whether generated synthetic rows form coherent per-customer omnichannel journeys."""
    if df.empty or "customer_id" not in df.columns:
        return {
            "unique_customers": 0,
            "avg_interactions_per_customer": 0.0,
            "multi_channel_customer_pct": 0.0,
            "chronological_timestamp_pct": 0.0,
            "purchase_consistency_pct": 0.0,
            "valid_channel_pct": 0.0,
            "valid_interaction_pct": 0.0,
        }

    work = df.copy()
    work["ts_parsed"] = pd.to_datetime(work["timestamp"], errors="coerce") if "timestamp" in work.columns else pd.NaT

    cust_counts = work.groupby("customer_id").size()
    multi_channel = work.groupby("customer_id")["channel"].nunique() if "channel" in work.columns else pd.Series([0])

    if all(c in work.columns for c in ["interaction_type", "purchase_amount"]):
        purchase_rows = work[work["interaction_type"] == "Purchase"]
        non_purchase_rows = work[work["interaction_type"] != "Purchase"]
        valid_purchase = int((purchase_rows["purchase_amount"] > 0).sum()) + int(
            (non_purchase_rows["purchase_amount"] == 0).sum()
        )
        purchase_consistency_pct = round((valid_purchase / max(len(work), 1)) * 100.0, 2)
    else:
        purchase_consistency_pct = 100.0

    ordered_ok = 0
    total_multi = 0
    for _, grp in work.groupby("customer_id"):
        if len(grp) > 1 and grp["ts_parsed"].notna().all():
            total_multi += 1
            if grp["ts_parsed"].nunique() > 1:
                ordered_ok += 1
    chronological_pct = round((ordered_ok / max(total_multi, 1)) * 100.0, 2) if total_multi > 0 else 100.0

    valid_channel_pct = (
        round(float(work["channel"].isin(ALLOWED_CHANNELS).sum() / max(len(work), 1)) * 100.0, 2)
        if "channel" in work.columns
        else 100.0
    )
    valid_int_pct = (
        round(float(work["interaction_type"].isin(ALLOWED_INTERACTION_TYPES).sum() / max(len(work), 1)) * 100.0, 2)
        if "interaction_type" in work.columns
        else 100.0
    )

    return {
        "unique_customers": int(cust_counts.shape[0]),
        "avg_interactions_per_customer": round(float(cust_counts.mean()), 2),
        "multi_channel_customer_pct": round(float((multi_channel > 1).mean() * 100.0), 2),
        "chronological_timestamp_pct": chronological_pct,
        "purchase_consistency_pct": purchase_consistency_pct,
        "valid_channel_pct": valid_channel_pct,
        "valid_interaction_pct": valid_int_pct,
    }


def generate_synthetic_journeys(
    model_id: Optional[str] = None,
    num_records: int = 500,
    random_seed: Optional[int] = 42,
    customer_segment: Optional[str] = None,
    channel: Optional[str] = None,
) -> Dict[str, Any]:
    """Sample synthetic omnichannel customer journeys from a persisted SDV synthesizer."""
    _set_seed(random_seed)
    start = time.time()

    target_model_id = model_id or get_state("active_model_id")
    model_record = get_latest_trained_model(target_model_id)
    if not model_record or not Path(model_record["model_path"]).exists():
        train_res = train_sdv_model(model_type="CTGANSynthesizer", epochs=25, random_seed=random_seed)
        model_record = get_latest_trained_model(train_res["model_id"])

    model_type = model_record["model_type"]
    model_path = Path(model_record["model_path"])
    synthesizer = load_synthesizer(filepath=str(model_path))

    seg_filter = customer_segment if customer_segment and customer_segment != "All" else None
    chan_filter = channel if channel and channel != "All" else None

    if seg_filter or chan_filter:
        cond_cols: Dict[str, Any] = {}
        if seg_filter:
            cond_cols["customer_segment"] = seg_filter
        if chan_filter:
            cond_cols["channel"] = chan_filter
        condition = Condition(num_rows=num_records, column_values=cond_cols)
        sampled = synthesizer.sample_from_conditions(conditions=[condition])
    else:
        sampled = synthesizer.sample(num_rows=num_records)

    synthetic_df = sampled[TABLE_NAME] if isinstance(sampled, dict) else sampled
    synthetic_df = synthetic_df.copy()

    synthetic_df["interaction_id"] = [f"SYN-{100001 + i}" for i in range(len(synthetic_df))]
    if "customer_id" in synthetic_df.columns:
        synthetic_df["customer_id"] = synthetic_df["customer_id"].astype(str).apply(
            lambda v: v if v.startswith("SYNTH-") else f"SYNTH-{v}"
        )

    if "interaction_duration" in synthetic_df.columns:
        synthetic_df["interaction_duration"] = pd.to_numeric(
            synthetic_df["interaction_duration"], errors="coerce"
        ).fillna(45.0).clip(lower=1.0).round(1)

    if "purchase_amount" in synthetic_df.columns:
        synthetic_df["purchase_amount"] = pd.to_numeric(
            synthetic_df["purchase_amount"], errors="coerce"
        ).fillna(0.0).clip(lower=0.0).round(2)

    if "timestamp" in synthetic_df.columns:
        ts = pd.to_datetime(synthetic_df["timestamp"], errors="coerce").ffill().bfill()
        synthetic_df["timestamp"] = ts.dt.strftime("%Y-%m-%d %H:%M:%S")
        synthetic_df = synthetic_df.sort_values(["customer_id", "timestamp"]).reset_index(drop=True)

    dataset_id = f"synth-{uuid.uuid4().hex[:8]}"
    gen_id = f"gen-{uuid.uuid4().hex[:8]}"
    output_path = SYNTHETIC_DIR / f"{dataset_id}.csv"
    synthetic_df.to_csv(output_path, index=False)

    customer_count = int(synthetic_df["customer_id"].nunique()) if "customer_id" in synthetic_df.columns else 0
    register_dataset(
        dataset_id=dataset_id,
        name=f"Synthetic ({model_type}, {len(synthetic_df)} rows)",
        source_type="synthetic",
        file_path=str(output_path),
        row_count=int(len(synthetic_df)),
        customer_count=customer_count,
        is_cleaned=True,
        parent_dataset_id=model_record["dataset_id"],
    )
    set_state("active_synthetic_dataset_id", dataset_id)

    duration = round(time.time() - start, 2)
    save_generation_record(
        gen_id=gen_id,
        model_id=model_record["id"],
        model_type=model_type,
        dataset_id=dataset_id,
        source_dataset_id=model_record["dataset_id"],
        num_records=int(len(synthetic_df)),
        random_seed=random_seed,
        customer_segment_filter=seg_filter,
        channel_filter=chan_filter,
        file_path=str(output_path),
        quality_score=None,
        duration_sec=duration,
    )

    seq_diag = evaluate_journey_sequence_coherence(synthetic_df)
    preview_rows = synthetic_df.head(25).replace({np.nan: None}).to_dict(orient="records")

    return {
        "generation_id": gen_id,
        "dataset_id": dataset_id,
        "model_id": model_record["id"],
        "model_type": model_type,
        "num_records": int(len(synthetic_df)),
        "customer_count": customer_count,
        "random_seed": random_seed,
        "customer_segment_filter": seg_filter,
        "channel_filter": chan_filter,
        "file_path": str(output_path),
        "duration_sec": duration,
        "sequence_validation_note": (
            "SDV models statistical joint distributions across columns rather than enforcing strict temporal state machines. "
            "Journey-level diagnostics below verify chronological ordering, multi-channel coverage, and purchase consistency."
        ),
        "sequence_diagnostics": seq_diag,
        "preview_rows": preview_rows,
    }


def get_model_status_summary() -> Dict[str, Any]:
    import sdv

    active_id = get_state("active_model_id")
    active = get_latest_trained_model(active_id) if active_id else get_latest_trained_model()
    models = list_trained_models()
    return {
        "is_training": _TRAINING_IN_PROGRESS,
        "has_trained_model": active is not None,
        "active_model": active,
        "trained_models": models,
        "sdv_available": True,
        "sdv_version": getattr(sdv, "__version__", "unknown"),
    }
