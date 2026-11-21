from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.database import get_state
from app.services.data_preprocessing import resolve_dataset_path

_LAST_PERSONALIZATION_PIPELINE: Optional[Pipeline] = None
_LAST_PERSONALIZATION_META: Optional[Dict[str, Any]] = None


def _build_sequential_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create non-leaky sequential features per customer from chronological journey records."""
    work = df.copy()
    if "timestamp" in work.columns:
        work["ts_sort"] = pd.to_datetime(work["timestamp"], errors="coerce")
        work = work.sort_values(["customer_id", "ts_sort"]).drop(columns=["ts_sort"])
    work = work.reset_index(drop=True)

    # Compute previous interaction, prior touchpoints count, and prior spend strictly BEFORE current step
    work["previous_interaction_type"] = (
        work.groupby("customer_id")["interaction_type"].shift(1).fillna("Journey Start")
    )
    work["previous_interactions_count"] = work.groupby("customer_id").cumcount()

    if "purchase_amount" in work.columns:
        cum_spend = work.groupby("customer_id")["purchase_amount"].cumsum() - work["purchase_amount"]
        work["previous_purchase_amount"] = cum_spend.clip(lower=0.0).round(2)
    else:
        work["previous_purchase_amount"] = 0.0

    # Target: binary conversion indicator (1 if Purchase or Converted, else 0)
    work["is_converted"] = (
        (work["conversion_status"] == "Converted") | (work["interaction_type"] == "Purchase")
    ).astype(int)

    return work


def train_personalization_model(
    dataset_id: Optional[str] = None,
    model_name: str = "RandomForestClassifier",
    test_size: float = 0.2,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """Train an experimental Scikit-learn cross-channel conversion prediction model with group-wise split."""
    global _LAST_PERSONALIZATION_PIPELINE, _LAST_PERSONALIZATION_META

    target_id = (
        dataset_id
        or get_state("active_synthetic_dataset_id")
        or get_state("active_cleaned_dataset_id")
        or "sample-default"
    )
    record, df = resolve_dataset_path(dataset_id=target_id, prefer_cleaned=True)

    feat_df = _build_sequential_features(df)

    cat_features = [
        "previous_interaction_type",
        "channel",
        "customer_segment",
        "journey_stage",
    ]
    num_features = [
        "previous_interactions_count",
        "previous_purchase_amount",
        "interaction_duration",
    ]

    for col in cat_features:
        if col not in feat_df.columns:
            feat_df[col] = "Unknown"
    for col in num_features:
        if col not in feat_df.columns:
            feat_df[col] = 0.0
        feat_df[col] = pd.to_numeric(feat_df[col], errors="coerce").fillna(0.0)

    X = feat_df[cat_features + num_features]
    y = feat_df["is_converted"]
    groups = feat_df["customer_id"].astype(str)

    if y.nunique() < 2:
        raise ValueError("Dataset needs both converted and non-converted interactions to train classification model.")

    # GroupShuffleSplit prevents customer-level data leakage across train/test splits
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_seed)
    train_idx, test_idx = next(splitter.split(X, y, groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_features),
            ("num", StandardScaler(), num_features),
        ]
    )

    if model_name == "LogisticRegression":
        clf = LogisticRegression(max_iter=500, random_state=random_seed)
    elif model_name == "GradientBoostingClassifier":
        clf = GradientBoostingClassifier(random_state=random_seed)
    else:
        model_name = "RandomForestClassifier"
        clf = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=random_seed)

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("classifier", clf)])
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    acc = round(float(accuracy_score(y_test, y_pred)) * 100.0, 2)
    prec = round(float(precision_score(y_test, y_pred, zero_division=0)) * 100.0, 2)
    rec = round(float(recall_score(y_test, y_pred, zero_division=0)) * 100.0, 2)
    f1 = round(float(f1_score(y_test, y_pred, zero_division=0)) * 100.0, 2)
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1]).tolist()

    _LAST_PERSONALIZATION_PIPELINE = pipeline
    _LAST_PERSONALIZATION_META = {
        "dataset_id": record["id"],
        "dataset_name": record["name"],
        "model_name": model_name,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1,
        "confusion_matrix": cm,
        "labels": ["Not Converted (0)", "Converted (1)"],
        "features_used": cat_features + num_features,
        "split_strategy": "GroupShuffleSplit by customer_id (prevents customer-level data leakage)",
        "disclaimer": (
            "Experimental Demonstration Only: This Scikit-learn classifier demonstrates how synthetic omnichannel "
            "data can benchmark conversion prediction features. It is not a production personalization engine."
        ),
    }
    return _LAST_PERSONALIZATION_META


def predict_sample_interaction(payload: Dict[str, Any]) -> Dict[str, Any]:
    global _LAST_PERSONALIZATION_PIPELINE, _LAST_PERSONALIZATION_META

    if _LAST_PERSONALIZATION_PIPELINE is None:
        train_personalization_model()

    row = pd.DataFrame(
        [
            {
                "previous_interaction_type": payload.get("previous_interaction_type", "Product View"),
                "channel": payload.get("channel", "Website"),
                "customer_segment": payload.get("customer_segment", "High-Value Omnichannel"),
                "journey_stage": payload.get("journey_stage", "Intent"),
                "previous_interactions_count": int(payload.get("previous_interactions_count", 4)),
                "previous_purchase_amount": float(payload.get("previous_purchase_amount", 0.0)),
                "interaction_duration": float(payload.get("interaction_duration", 180.0)),
            }
        ]
    )

    pred = int(_LAST_PERSONALIZATION_PIPELINE.predict(row)[0])
    if hasattr(_LAST_PERSONALIZATION_PIPELINE, "predict_proba"):
        proba = float(_LAST_PERSONALIZATION_PIPELINE.predict_proba(row)[0][1])
    else:
        proba = float(pred)

    recommended_action = (
        "Trigger high-intent checkout incentive or loyalty perk"
        if proba >= 0.65
        else "Send personalized cross-channel product follow-up"
        if proba >= 0.35
        else "Continue low-friction awareness & discovery content"
    )

    return {
        "predicted_conversion": bool(pred == 1),
        "conversion_probability": round(proba * 100.0, 2),
        "recommended_next_action": recommended_action,
        "model_info": _LAST_PERSONALIZATION_META,
    }
