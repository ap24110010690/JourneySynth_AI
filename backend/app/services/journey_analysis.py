from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.database import (
    get_latest_validation_report,
    get_state,
    list_generation_history,
)
from app.services.data_preprocessing import resolve_dataset_path


def _pick_analytics_dataset(dataset_id: Optional[str] = None) -> tuple[Dict[str, Any], pd.DataFrame]:
    target_id = (
        dataset_id
        or get_state("active_synthetic_dataset_id")
        or get_state("active_cleaned_dataset_id")
        or get_state("active_raw_dataset_id")
        or "sample-default"
    )
    return resolve_dataset_path(dataset_id=target_id, prefer_cleaned=True)


def get_overview_metrics(dataset_id: Optional[str] = None) -> Dict[str, Any]:
    record, df = _pick_analytics_dataset(dataset_id)

    total_interactions = int(len(df))
    total_customers = int(df["customer_id"].nunique()) if "customer_id" in df.columns else 0
    num_channels = int(df["channel"].nunique()) if "channel" in df.columns else 0
    avg_interactions = round(total_interactions / max(total_customers, 1), 2)

    most_common_interaction = (
        str(df["interaction_type"].mode().iloc[0])
        if "interaction_type" in df.columns and not df["interaction_type"].dropna().empty
        else "N/A"
    )

    # Journey completion rate: % of customers who reached Conversion/Purchase
    if "customer_id" in df.columns and "conversion_status" in df.columns:
        converted_custs = df[df["conversion_status"] == "Converted"]["customer_id"].nunique()
        completion_rate = round((converted_custs / max(total_customers, 1)) * 100.0, 2)
    elif "customer_id" in df.columns and "interaction_type" in df.columns:
        converted_custs = df[df["interaction_type"] == "Purchase"]["customer_id"].nunique()
        completion_rate = round((converted_custs / max(total_customers, 1)) * 100.0, 2)
    else:
        completion_rate = 0.0

    # Channel distribution summary
    channel_dist = []
    if "channel" in df.columns:
        counts = df["channel"].value_counts()
        for ch, cnt in counts.items():
            channel_dist.append(
                {
                    "channel": str(ch),
                    "count": int(cnt),
                    "percentage": round((int(cnt) / max(total_interactions, 1)) * 100.0, 2),
                }
            )

    # Latest quality score from validation reports
    latest_val = get_latest_validation_report(
        record["id"] if record["source_type"] == "synthetic" else None
    )
    quality_score = latest_val["overall_score"] if latest_val else None

    history = list_generation_history()

    # Total synthetic customers across active or latest synthetic dataset
    synth_id = get_state("active_synthetic_dataset_id")
    if synth_id:
        try:
            _, synth_df = resolve_dataset_path(synth_id)
            total_synthetic_customers = int(synth_df["customer_id"].nunique())
            total_synthetic_interactions = int(len(synth_df))
        except Exception:
            total_synthetic_customers = 0
            total_synthetic_interactions = 0
    else:
        total_synthetic_customers = 0
        total_synthetic_interactions = 0

    return {
        "active_dataset": record,
        "total_synthetic_customers": total_synthetic_customers,
        "total_synthetic_interactions": total_synthetic_interactions,
        "total_customers": total_customers,
        "total_interactions": total_interactions,
        "num_channels": num_channels,
        "avg_interactions_per_customer": avg_interactions,
        "dataset_quality_score": quality_score,
        "most_common_interaction": most_common_interaction,
        "journey_completion_rate": completion_rate,
        "channel_distribution": channel_dist,
        "recent_generation_history": history[:8],
        "total_generation_runs": len(history),
    }


def get_channel_analytics(dataset_id: Optional[str] = None) -> Dict[str, Any]:
    record, df = _pick_analytics_dataset(dataset_id)
    total = max(len(df), 1)

    # 1. Channel distribution
    channels = []
    if "channel" in df.columns:
        for ch, grp in df.groupby("channel"):
            conv_cnt = int((grp["conversion_status"] == "Converted").sum()) if "conversion_status" in grp.columns else 0
            rev = float(grp["purchase_amount"].sum()) if "purchase_amount" in grp.columns else 0.0
            dur = float(grp["interaction_duration"].mean()) if "interaction_duration" in grp.columns else 0.0
            channels.append(
                {
                    "channel": str(ch),
                    "count": int(len(grp)),
                    "percentage": round((len(grp) / total) * 100.0, 2),
                    "conversions": conv_cnt,
                    "conversion_rate": round((conv_cnt / max(len(grp), 1)) * 100.0, 2),
                    "total_revenue": round(rev, 2),
                    "avg_duration": round(dur, 1),
                }
            )
        channels.sort(key=lambda x: x["count"], reverse=True)

    # 2. Interaction frequency
    interactions = []
    if "interaction_type" in df.columns:
        for it, cnt in df["interaction_type"].value_counts().items():
            interactions.append(
                {
                    "interaction_type": str(it),
                    "count": int(cnt),
                    "percentage": round((int(cnt) / total) * 100.0, 2),
                }
            )

    # 3. Journey stage funnel
    stage_order = ["Awareness", "Consideration", "Intent", "Conversion", "Retention"]
    funnel = []
    if "journey_stage" in df.columns:
        stage_counts = df["journey_stage"].value_counts().to_dict()
        for stage in stage_order:
            cnt = int(stage_counts.get(stage, 0))
            cust_cnt = int(df[df["journey_stage"] == stage]["customer_id"].nunique()) if "customer_id" in df.columns else 0
            funnel.append(
                {
                    "stage": stage,
                    "interactions": cnt,
                    "customers": cust_cnt,
                }
            )

    # 4. Daily interaction trend
    daily_trend = []
    if "timestamp" in df.columns:
        work = df.copy()
        work["date"] = pd.to_datetime(work["timestamp"], errors="coerce").dt.strftime("%Y-%m-%d")
        work = work.dropna(subset=["date"])
        for dt_val, grp in work.groupby("date"):
            daily_trend.append(
                {
                    "date": str(dt_val),
                    "interactions": int(len(grp)),
                    "purchases": int((grp["interaction_type"] == "Purchase").sum()) if "interaction_type" in grp.columns else 0,
                    "revenue": round(float(grp["purchase_amount"].sum()), 2) if "purchase_amount" in grp.columns else 0.0,
                }
            )
        daily_trend.sort(key=lambda x: x["date"])

    # 5. Customer segment comparison
    segments = []
    if "customer_segment" in df.columns:
        for seg, grp in df.groupby("customer_segment"):
            custs = max(int(grp["customer_id"].nunique()), 1) if "customer_id" in grp.columns else 1
            conv_custs = (
                int(grp[grp["conversion_status"] == "Converted"]["customer_id"].nunique())
                if "conversion_status" in grp.columns and "customer_id" in grp.columns
                else 0
            )
            segments.append(
                {
                    "segment": str(seg),
                    "customers": custs,
                    "interactions": int(len(grp)),
                    "avg_touchpoints": round(len(grp) / custs, 2),
                    "conversion_rate": round((conv_custs / custs) * 100.0, 2),
                    "avg_purchase_amount": round(
                        float(grp.loc[grp["purchase_amount"] > 0, "purchase_amount"].mean())
                        if "purchase_amount" in grp.columns and (grp["purchase_amount"] > 0).any()
                        else 0.0,
                        2,
                    ),
                }
            )

    # 6. Purchase patterns by product category
    categories = []
    if "product_category" in df.columns:
        for cat, grp in df.groupby("product_category"):
            purchases = grp[grp["interaction_type"] == "Purchase"] if "interaction_type" in grp.columns else grp
            categories.append(
                {
                    "category": str(cat),
                    "interactions": int(len(grp)),
                    "purchases": int(len(purchases)),
                    "revenue": round(float(grp["purchase_amount"].sum()), 2) if "purchase_amount" in grp.columns else 0.0,
                }
            )
        categories.sort(key=lambda x: x["revenue"], reverse=True)

    # Customer touchpoint distribution summary
    touchpoints = []
    if "customer_id" in df.columns:
        tp_counts = df.groupby("customer_id").size().value_counts().sort_index()
        for tp, cnt in tp_counts.items():
            touchpoints.append({"touchpoints": int(tp), "customers": int(cnt)})

    return {
        "dataset": record,
        "channels": channels,
        "interaction_types": interactions,
        "journey_funnel": funnel,
        "daily_trend": daily_trend[-45:],
        "segments": segments,
        "product_categories": categories,
        "touchpoint_distribution": touchpoints,
    }


def get_channel_transitions(dataset_id: Optional[str] = None) -> Dict[str, Any]:
    record, df = _pick_analytics_dataset(dataset_id)
    if df.empty or "customer_id" not in df.columns or "channel" not in df.columns:
        return {"dataset": record, "transitions": [], "matrix": {}}

    work = df.sort_values(["customer_id", "timestamp"]) if "timestamp" in df.columns else df.copy()
    pair_counts: Dict[tuple, int] = {}
    total_transitions = 0

    for _, grp in work.groupby("customer_id"):
        chans = grp["channel"].dropna().tolist()
        for src, dst in zip(chans[:-1], chans[1:]):
            pair_counts[(str(src), str(dst))] = pair_counts.get((str(src), str(dst)), 0) + 1
            total_transitions += 1

    transitions = [
        {
            "from_channel": src,
            "to_channel": dst,
            "label": f"{src} → {dst}",
            "count": cnt,
            "percentage": round((cnt / max(total_transitions, 1)) * 100.0, 2),
        }
        for (src, dst), cnt in sorted(pair_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "dataset": record,
        "total_transitions": total_transitions,
        "transitions": transitions[:18],
    }


def list_customer_ids(dataset_id: Optional[str] = None, search: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    record, df = _pick_analytics_dataset(dataset_id)
    if "customer_id" not in df.columns:
        return {"dataset": record, "customers": []}

    grouped = df.groupby("customer_id")
    customers = []
    for cid, grp in grouped:
        cid_str = str(cid)
        if search and search.lower() not in cid_str.lower():
            continue
        has_purchase = bool((grp["interaction_type"] == "Purchase").any()) if "interaction_type" in grp.columns else False
        customers.append(
            {
                "customer_id": cid_str,
                "interactions": int(len(grp)),
                "channels": int(grp["channel"].nunique()) if "channel" in grp.columns else 0,
                "segment": str(grp["customer_segment"].iloc[0]) if "customer_segment" in grp.columns else "Unknown",
                "converted": has_purchase,
                "total_spend": round(float(grp["purchase_amount"].sum()), 2) if "purchase_amount" in grp.columns else 0.0,
            }
        )

    customers.sort(key=lambda c: (-int(c["converted"]), -c["interactions"], c["customer_id"]))
    return {
        "dataset": record,
        "total_customers": int(df["customer_id"].nunique()),
        "customers": customers[:limit],
    }


def get_customer_timeline(customer_id: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
    record, df = _pick_analytics_dataset(dataset_id)
    if "customer_id" not in df.columns:
        raise ValueError("Dataset does not contain customer_id column.")

    cust_df = df[df["customer_id"].astype(str) == str(customer_id)].copy()
    if cust_df.empty:
        raise ValueError(f"Customer '{customer_id}' was not found in dataset '{record['name']}'.")

    if "timestamp" in cust_df.columns:
        cust_df["ts_sort"] = pd.to_datetime(cust_df["timestamp"], errors="coerce")
        cust_df = cust_df.sort_values("ts_sort").drop(columns=["ts_sort"])

    timeline = cust_df.replace({np.nan: None}).to_dict(orient="records")
    channels_used = cust_df["channel"].dropna().unique().tolist() if "channel" in cust_df.columns else []

    return {
        "dataset": record,
        "customer_id": customer_id,
        "segment": str(cust_df["customer_segment"].iloc[0]) if "customer_segment" in cust_df.columns else "Unknown",
        "location": str(cust_df["location"].iloc[0]) if "location" in cust_df.columns else "Unknown",
        "total_interactions": int(len(cust_df)),
        "channels_used": channels_used,
        "total_purchase_amount": round(float(cust_df["purchase_amount"].sum()), 2) if "purchase_amount" in cust_df.columns else 0.0,
        "converted": bool((cust_df["conversion_status"] == "Converted").any()) if "conversion_status" in cust_df.columns else False,
        "timeline": timeline,
    }
