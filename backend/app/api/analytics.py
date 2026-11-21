from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.journey_analysis import (
    get_channel_analytics,
    get_channel_transitions,
    get_customer_timeline,
    get_overview_metrics,
    list_customer_ids,
)

router = APIRouter(tags=["Omnichannel Analytics & Explorer"])


@router.get("/api/analytics/overview")
def analytics_overview(dataset_id: Optional[str] = Query(default=None)):
    try:
        return get_overview_metrics(dataset_id=dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/analytics/channels")
def analytics_channels(dataset_id: Optional[str] = Query(default=None)):
    try:
        return get_channel_analytics(dataset_id=dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/analytics/transitions")
def analytics_transitions(dataset_id: Optional[str] = Query(default=None)):
    try:
        return get_channel_transitions(dataset_id=dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/analytics/customers")
def analytics_customers(
    dataset_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    try:
        return list_customer_ids(dataset_id=dataset_id, search=search, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/analytics/customers/{customer_id}")
def analytics_customer_timeline(
    customer_id: str,
    dataset_id: Optional[str] = Query(default=None),
):
    try:
        return get_customer_timeline(customer_id=customer_id, dataset_id=dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
