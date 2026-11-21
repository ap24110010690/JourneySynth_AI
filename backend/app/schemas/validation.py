from typing import Optional
from pydantic import BaseModel


class ValidateRequest(BaseModel):
    synthetic_dataset_id: Optional[str] = None
    reference_dataset_id: Optional[str] = None


class PersonalizationTrainRequest(BaseModel):
    dataset_id: Optional[str] = None
    target: str = "conversion_status"
    model_name: str = "RandomForestClassifier"
    test_size: float = 0.2
    random_seed: int = 42


class PersonalizationPredictRequest(BaseModel):
    previous_interaction_type: str = "Product View"
    channel: str = "Website"
    customer_segment: str = "High-Value Omnichannel"
    journey_stage: str = "Intent"
    previous_interactions_count: int = 4
    previous_purchase_amount: float = 0.0
    interaction_duration: float = 180.0
