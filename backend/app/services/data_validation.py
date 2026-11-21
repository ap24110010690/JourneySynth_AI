import json
import uuid
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sdmetrics.reports import QualityReport

from app.config import (
    ALLOWED_CHANNELS,
    ALLOWED_INTERACTION_TYPES,
    REPORTS_DIR,
    REQUIRED_COLUMNS,
)
from app.database import (
    get_state,
    save_validation_report,
    update_generation_quality,
)
from app.services.data_preprocessing import resolve_dataset_path
from app.services.sdv_generator import (
    TABLE_NAME,
    build_sdv_metadata,
    evaluate_journey_sequence_coherence,
)


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return default
        return float(val)
    except Exception:
        return default


def _compute_transition_matrix(df: pd.DataFrame) -> Dict[str, float]:
    """Compute top normalized channel->channel transition probabilities per customer."""
    if df.empty or "customer_id" not in df.columns or "channel" not in df.columns:
        return {}
    work = df.sort_values(["customer_id", "timestamp"]) if "timestamp" in df.columns else df.copy()
    transitions: Dict[str, int] = {}
    total = 0
    for _, grp in work.groupby("customer_id"):
        chans = grp["channel"].dropna().tolist()
        for a, b in zip(chans[:-1], chans[1:]):
            key = f"{a} -> {b}"
            transitions[key] = transitions.get(key, 0) + 1
            total += 1
    if total == 0:
        return {}
    return {k: round(v / total, 4) for k, v in transitions.items()}


def validate_synthetic_dataset(
    synthetic_dataset_id: Optional[str] = None,
    reference_dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Run comprehensive quality validation using SDMetrics + Pandas statistical & journey checks."""
    synth_id = synthetic_dataset_id or get_state("active_synthetic_dataset_id")
    if not synth_id:
        raise ValueError("No synthetic dataset is available to validate. Generate synthetic journeys first.")

    ref_id = reference_dataset_id or get_state("active_cleaned_dataset_id") or get_state("active_raw_dataset_id") or "sample-default"

    synth_rec, synth_df = resolve_dataset_path(dataset_id=synth_id)
    ref_rec, ref_df = resolve_dataset_path(dataset_id=ref_id, prefer_cleaned=True)

    common_cols = [c for c in ref_df.columns if c in synth_df.columns]
    ref_aligned = ref_df[common_cols].copy()
    synth_aligned = synth_df[common_cols].copy()

    if "timestamp" in common_cols:
        for frame in (ref_aligned, synth_aligned):
            ts = pd.to_datetime(frame["timestamp"], errors="coerce").ffill().bfill()
            frame["timestamp"] = ts.dt.strftime("%Y-%m-%d %H:%M:%S")

    # A. Completeness
    total_cells = int(synth_df.shape[0] * synth_df.shape[1])
    missing_cells = int(synth_df.isna().sum().sum())
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in synth_df.columns]
    completeness_score = round((1.0 - (missing_cells / max(total_cells, 1))) * 100.0, 2)
    if missing_cols:
        completeness_score = max(0.0, completeness_score - len(missing_cols) * 10.0)

    completeness = {
        "missing_values": missing_cells,
        "missing_pct": round((missing_cells / max(total_cells, 1)) * 100.0, 3),
        "missing_required_columns": missing_cols,
        "completeness_score": completeness_score,
        "status": "PASS" if missing_cells == 0 and not missing_cols else "WARN",
    }

    # B. Consistency
    valid_channels = (
        round(float(synth_df["channel"].isin(ALLOWED_CHANNELS).mean() * 100.0), 2)
        if "channel" in synth_df.columns
        else 100.0
    )
    valid_interactions = (
        round(float(synth_df["interaction_type"].isin(ALLOWED_INTERACTION_TYPES).mean() * 100.0), 2)
        if "interaction_type" in synth_df.columns
        else 100.0
    )
    valid_timestamps = 100.0
    if "timestamp" in synth_df.columns:
        valid_timestamps = round(
            float(pd.to_datetime(synth_df["timestamp"], errors="coerce").notna().mean() * 100.0),
            2,
        )
    valid_ranges = 100.0
    if "interaction_duration" in synth_df.columns and "purchase_amount" in synth_df.columns:
        dur_ok = (pd.to_numeric(synth_df["interaction_duration"], errors="coerce") >= 0).mean()
        amt_ok = (pd.to_numeric(synth_df["purchase_amount"], errors="coerce") >= 0).mean()
        valid_ranges = round(float(((dur_ok + amt_ok) / 2.0) * 100.0), 2)

    consistency_score = round(
        (valid_channels + valid_interactions + valid_timestamps + valid_ranges) / 4.0, 2
    )
    consistency = {
        "valid_channel_pct": valid_channels,
        "valid_interaction_type_pct": valid_interactions,
        "valid_timestamp_pct": valid_timestamps,
        "valid_numerical_range_pct": valid_ranges,
        "consistency_score": consistency_score,
        "status": "PASS" if consistency_score >= 95.0 else "WARN",
    }

    # C. Uniqueness
    dup_ids = int(synth_df["interaction_id"].duplicated().sum()) if "interaction_id" in synth_df.columns else 0
    dup_rows = int(synth_df.duplicated().sum())
    uniqueness_score = round((1.0 - (dup_rows / max(len(synth_df), 1))) * 100.0, 2)
    uniqueness = {
        "duplicate_interaction_ids": dup_ids,
        "duplicate_records": dup_rows,
        "uniqueness_score": uniqueness_score,
        "status": "PASS" if dup_ids == 0 and dup_rows == 0 else "WARN",
    }

    # D. Statistical Similarity via SDMetrics QualityReport
    metadata = build_sdv_metadata(ref_aligned)
    meta_dict = metadata.to_dict()

    ref_sdm = ref_aligned.copy()
    synth_sdm = synth_aligned.copy()
    if "timestamp" in common_cols:
        ref_sdm["timestamp"] = pd.to_datetime(ref_sdm["timestamp"], errors="coerce")
        synth_sdm["timestamp"] = pd.to_datetime(synth_sdm["timestamp"], errors="coerce")

    quality_report = QualityReport()
    quality_report.generate(
        {TABLE_NAME: ref_sdm},
        {TABLE_NAME: synth_sdm},
        meta_dict,
        verbose=False,
    )

    sdmetrics_overall = round(_safe_float(quality_report.get_score()) * 100.0, 2)
    props_df = quality_report.get_properties()
    prop_scores = {}
    for _, row in props_df.iterrows():
        prop_scores[str(row["Property"])] = round(_safe_float(row["Score"]) * 100.0, 2)

    col_shapes_df = quality_report.get_details(property_name="Column Shapes")
    column_results: List[Dict[str, Any]] = []
    for _, row in col_shapes_df.iterrows():
        score_pct = round(_safe_float(row.get("Score")) * 100.0, 2)
        column_results.append(
            {
                "column": str(row.get("Column")),
                "metric": str(row.get("Metric")),
                "score": score_pct,
                "status": "PASS" if score_pct >= 70.0 else "WARN",
            }
        )

    numerical_comparisons = []
    for num_col in ["interaction_duration", "purchase_amount"]:
        if num_col in ref_aligned.columns and num_col in synth_aligned.columns:
            r_series = pd.to_numeric(ref_aligned[num_col], errors="coerce").dropna()
            s_series = pd.to_numeric(synth_aligned[num_col], errors="coerce").dropna()
            numerical_comparisons.append(
                {
                    "column": num_col,
                    "original_mean": round(float(r_series.mean()), 2) if not r_series.empty else 0.0,
                    "synthetic_mean": round(float(s_series.mean()), 2) if not s_series.empty else 0.0,
                    "original_std": round(float(r_series.std()), 2) if len(r_series) > 1 else 0.0,
                    "synthetic_std": round(float(s_series.std()), 2) if len(s_series) > 1 else 0.0,
                }
            )

    categorical_comparisons: Dict[str, List[Dict[str, Any]]] = {}
    for cat_col in ["channel", "interaction_type", "customer_segment", "journey_stage"]:
        if cat_col in ref_aligned.columns and cat_col in synth_aligned.columns:
            r_dist = ref_aligned[cat_col].value_counts(normalize=True) * 100.0
            s_dist = synth_aligned[cat_col].value_counts(normalize=True) * 100.0
            all_cats = sorted(set(r_dist.index.tolist()) | set(s_dist.index.tolist()))
            categorical_comparisons[cat_col] = [
                {
                    "category": str(cat),
                    "original_pct": round(float(r_dist.get(cat, 0.0)), 2),
                    "synthetic_pct": round(float(s_dist.get(cat, 0.0)), 2),
                }
                for cat in all_cats
            ]

    # E. Journey Pattern Validation
    seq_diag = evaluate_journey_sequence_coherence(synth_df)
    ref_trans = _compute_transition_matrix(ref_aligned)
    synth_trans = _compute_transition_matrix(synth_aligned)
    all_trans_keys = sorted(
        set(ref_trans.keys()) | set(synth_trans.keys()),
        key=lambda k: ref_trans.get(k, 0.0),
        reverse=True,
    )[:8]
    transition_comparison = [
        {
            "transition": k,
            "original_pct": round(ref_trans.get(k, 0.0) * 100.0, 2),
            "synthetic_pct": round(synth_trans.get(k, 0.0) * 100.0, 2),
        }
        for k in all_trans_keys
    ]

    overall_score = round(
        (0.55 * sdmetrics_overall)
        + (0.15 * completeness_score)
        + (0.15 * consistency_score)
        + (0.15 * uniqueness_score),
        2,
    )
    pass_status = "PASS" if overall_score >= 75.0 else "REVIEW"

    report_id = f"val-{uuid.uuid4().hex[:8]}"
    report_payload = {
        "report_id": report_id,
        "synthetic_dataset_id": synth_rec["id"],
        "reference_dataset_id": ref_rec["id"],
        "synthetic_rows": int(len(synth_df)),
        "reference_rows": int(len(ref_df)),
        "overall_score": overall_score,
        "sdmetrics_score": sdmetrics_overall,
        "sdmetrics_properties": prop_scores,
        "pass_status": pass_status,
        "completeness": completeness,
        "consistency": consistency,
        "uniqueness": uniqueness,
        "column_results": column_results,
        "numerical_comparisons": numerical_comparisons,
        "categorical_comparisons": categorical_comparisons,
        "journey_pattern_validation": {
            **seq_diag,
            "transition_comparison": transition_comparison,
        },
        "privacy_disclaimer": (
            "Statistical similarity metrics (SDMetrics Column Shapes & Column Pair Trends) measure how closely synthetic "
            "distributions resemble the source data. High statistical similarity does NOT guarantee formal privacy or "
            "anonymity (such as differential privacy or k-anonymity) without dedicated privacy leakage testing."
        ),
    }

    report_path = REPORTS_DIR / f"{report_id}.json"
    report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")

    save_validation_report(
        report_id=report_id,
        synthetic_dataset_id=synth_rec["id"],
        reference_dataset_id=ref_rec["id"],
        overall_score=overall_score,
        pass_status=pass_status,
        report_dict=report_payload,
        report_path=str(report_path),
    )
    update_generation_quality(synth_rec["id"], overall_score)
    return report_payload
