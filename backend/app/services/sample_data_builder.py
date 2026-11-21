import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from app.config import (
    ALLOWED_CHANNELS,
    ALLOWED_SEGMENTS,
    SAMPLE_DATASET_PATH,
)

PRODUCT_CATEGORIES = [
    "Electronics",
    "Apparel",
    "Home & Living",
    "Beauty & Personal Care",
    "Sports & Outdoors",
    "Footwear",
]

DEVICES = ["Desktop", "Mobile iOS", "Mobile Android", "Tablet", "POS Terminal"]
LOCATIONS = [
    "New York, NY",
    "San Francisco, CA",
    "Chicago, IL",
    "Austin, TX",
    "Seattle, WA",
    "Boston, MA",
    "Denver, CO",
    "Miami, FL",
]
CAMPAIGNS = [
    "Organic Search",
    "Q4 Omnichannel Promo",
    "Paid Social Retargeting",
    "Email Loyalty Drip",
    "Direct Brand",
    "In-Store QR Display",
]

CHANNEL_INTERACTIONS = {
    "Website": [("Page View", "Awareness"), ("Search", "Consideration"), ("Product View", "Consideration"), ("Add to Cart", "Intent"), ("Purchase", "Conversion"), ("Product Review", "Retention")],
    "Mobile Application": [("App Open", "Awareness"), ("Search", "Consideration"), ("Product View", "Consideration"), ("Add to Cart", "Intent"), ("Purchase", "Conversion"), ("Product Review", "Retention")],
    "Email": [("Email Open", "Awareness"), ("Email Click", "Consideration")],
    "Physical Store": [("Store Visit", "Consideration"), ("Product View", "Intent"), ("Purchase", "Conversion")],
    "Social Media": [("Page View", "Awareness"), ("Product View", "Consideration")],
    "Customer Support": [("Customer Support", "Retention")],
}

SEGMENT_CHANNEL_WEIGHTS = {
    "High-Value Omnichannel": [0.28, 0.26, 0.16, 0.18, 0.06, 0.06],
    "Digital-First Explorer": [0.36, 0.34, 0.12, 0.04, 0.10, 0.04],
    "Store Loyalist": [0.16, 0.14, 0.12, 0.44, 0.06, 0.08],
    "Occasional Browser": [0.34, 0.22, 0.18, 0.08, 0.14, 0.04],
    "At-Risk Shopper": [0.22, 0.18, 0.24, 0.08, 0.08, 0.20],
}


def generate_sample_dataset(
    output_path: Optional[Path] = None,
    target_records: int = 1200,
    seed: int = 42,
) -> Path:
    """Create a realistic omnichannel customer journey sample CSV (>=1000 rows)."""
    target_path = output_path or SAMPLE_DATASET_PATH
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)

    rows = []
    interaction_counter = 100001
    base_start = datetime(2026, 8, 1, 8, 0, 0)

    customer_idx = 1001
    while len(rows) < target_records:
        cust_id = f"CUST-{customer_idx}"
        customer_idx += 1
        segment = rng.choices(
            ALLOWED_SEGMENTS,
            weights=[0.24, 0.28, 0.18, 0.20, 0.10],
            k=1,
        )[0]
        location = rng.choice(LOCATIONS)
        preferred_cat = rng.choice(PRODUCT_CATEGORIES)
        journey_len = int(np_rng.integers(3, 9))
        current_time = base_start + timedelta(
            days=int(np_rng.integers(0, 75)),
            hours=int(np_rng.integers(0, 14)),
            minutes=int(np_rng.integers(0, 59)),
        )

        # Build coherent progression per customer
        has_cart = False
        has_purchased = False
        session_num = 1
        session_id = f"SESS-{customer_idx}-{session_num}"

        for step in range(journey_len):
            if len(rows) >= target_records:
                break

            weights = SEGMENT_CHANNEL_WEIGHTS[segment]
            channel = rng.choices(ALLOWED_CHANNELS, weights=weights, k=1)[0]

            # Choose interaction aligned with journey progression
            if step == 0:
                if channel == "Email":
                    interaction_type, stage = "Email Open", "Awareness"
                elif channel == "Mobile Application":
                    interaction_type, stage = "App Open", "Awareness"
                elif channel == "Physical Store":
                    interaction_type, stage = "Store Visit", "Awareness"
                elif channel == "Customer Support":
                    interaction_type, stage = "Customer Support", "Consideration"
                else:
                    interaction_type, stage = "Page View", "Awareness"
            elif not has_cart and step < journey_len - 1:
                if channel == "Email":
                    interaction_type, stage = rng.choice([("Email Open", "Awareness"), ("Email Click", "Consideration")])
                elif channel == "Physical Store":
                    interaction_type, stage = rng.choice([("Store Visit", "Consideration"), ("Product View", "Consideration")])
                elif channel == "Customer Support":
                    interaction_type, stage = "Customer Support", "Consideration"
                elif channel in ("Website", "Mobile Application"):
                    if rng.random() < 0.38:
                        interaction_type, stage = "Add to Cart", "Intent"
                        has_cart = True
                    else:
                        interaction_type, stage = rng.choice([("Search", "Consideration"), ("Product View", "Consideration")])
                else:
                    interaction_type, stage = "Product View", "Consideration"
            elif has_cart and not has_purchased and (channel in ("Website", "Mobile Application", "Physical Store")):
                if rng.random() < 0.65:
                    interaction_type, stage = "Purchase", "Conversion"
                    has_purchased = True
                else:
                    interaction_type, stage = "Product View", "Intent"
            elif has_purchased:
                if channel == "Customer Support":
                    interaction_type, stage = "Customer Support", "Retention"
                elif channel in ("Website", "Mobile Application"):
                    interaction_type, stage = rng.choice([("Product Review", "Retention"), ("Page View", "Retention")])
                else:
                    interaction_type, stage = rng.choice(CHANNEL_INTERACTIONS[channel])
            else:
                interaction_type, stage = rng.choice(CHANNEL_INTERACTIONS[channel])

            # Device alignment
            if channel == "Mobile Application":
                device = rng.choice(["Mobile iOS", "Mobile Android"])
            elif channel == "Physical Store":
                device = rng.choice(["POS Terminal", "Mobile iOS", "Mobile Android"])
            elif channel == "Website":
                device = rng.choice(["Desktop", "Mobile iOS", "Mobile Android", "Tablet"])
            elif channel == "Email":
                device = rng.choice(["Mobile iOS", "Mobile Android", "Desktop"])
            else:
                device = rng.choice(["Desktop", "Mobile iOS", "Mobile Android"])

            # Duration & purchase amount
            if interaction_type == "Purchase":
                duration = round(float(np_rng.uniform(110.0, 520.0)), 1)
                purchase_amount = round(float(np_rng.lognormal(mean=4.65, sigma=0.55)), 2)
                purchase_amount = min(max(purchase_amount, 18.0), 1450.0)
                conversion_status = "Converted"
            elif interaction_type == "Add to Cart":
                duration = round(float(np_rng.uniform(60.0, 310.0)), 1)
                purchase_amount = 0.0
                conversion_status = "In Progress"
            elif interaction_type in ("Email Open", "App Open"):
                duration = round(float(np_rng.uniform(12.0, 95.0)), 1)
                purchase_amount = 0.0
                conversion_status = "Not Converted"
            else:
                duration = round(float(np_rng.uniform(25.0, 420.0)), 1)
                purchase_amount = 0.0
                conversion_status = "Converted" if has_purchased and stage == "Retention" else "Not Converted"

            cat = preferred_cat if rng.random() < 0.72 else rng.choice(PRODUCT_CATEGORIES)
            campaign = (
                "In-Store QR Display"
                if channel == "Physical Store" and rng.random() < 0.5
                else "Email Loyalty Drip"
                if channel == "Email"
                else rng.choice(CAMPAIGNS)
            )

            rows.append(
                {
                    "customer_id": cust_id,
                    "interaction_id": f"INT-{interaction_counter}",
                    "session_id": session_id,
                    "channel": channel,
                    "interaction_type": interaction_type,
                    "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "product_category": cat,
                    "device_type": device,
                    "location": location,
                    "campaign_source": campaign,
                    "interaction_duration": duration,
                    "purchase_amount": purchase_amount,
                    "conversion_status": conversion_status,
                    "customer_segment": segment,
                    "journey_stage": stage,
                }
            )
            interaction_counter += 1

            # Advance time and sometimes start new session
            gap_hours = int(np_rng.choice([0, 1, 4, 18, 36, 72], p=[0.25, 0.25, 0.20, 0.15, 0.10, 0.05]))
            gap_mins = int(np_rng.integers(3, 55))
            current_time = current_time + timedelta(hours=gap_hours, minutes=gap_mins)
            if gap_hours >= 4:
                session_num += 1
                session_id = f"SESS-{customer_idx}-{session_num}"

    df = pd.DataFrame(rows)

    # Inject small, realistic data quality issues (~1.5%) so Pandas preprocessing has real anomalies to clean
    dirty_indices = rng.sample(range(len(df)), k=18)
    for idx in dirty_indices[:6]:
        df.at[idx, "campaign_source"] = np.nan
    for idx in dirty_indices[6:10]:
        df.at[idx, "location"] = np.nan
    for idx in dirty_indices[10:14]:
        df.at[idx, "channel"] = f"  {str(df.at[idx, 'channel']).lower()} "
    for idx in dirty_indices[14:16]:
        df.at[idx, "interaction_duration"] = -15.0  # invalid negative duration
    for idx in dirty_indices[16:18]:
        df.at[idx, "interaction_type"] = str(df.at[idx, "interaction_type"]).lower()

    # Add 4 duplicate rows for duplicate removal demonstration
    dup_rows = df.iloc[[12, 47, 108, 256]].copy()
    df = pd.concat([df, dup_rows], ignore_index=True)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(target_path, index=False)
    return target_path
