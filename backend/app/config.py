from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent

DATA_DIR = BASE_DIR / "data"
CLEANED_DIR = DATA_DIR / "cleaned"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
UPLOADED_DIR = DATA_DIR / "uploaded"

MODELS_DIR = BASE_DIR / "models"
METADATA_DIR = MODELS_DIR / "metadata"
SYNTHESIZERS_DIR = MODELS_DIR / "synthesizers"
REPORTS_DIR = BASE_DIR / "reports"

SAMPLE_DATASET_PATH = DATA_DIR / "sample_journey_data.csv"
DB_PATH = BASE_DIR / "journeysynth.db"

for directory in [
    DATA_DIR,
    CLEANED_DIR,
    SYNTHETIC_DIR,
    UPLOADED_DIR,
    METADATA_DIR,
    SYNTHESIZERS_DIR,
    REPORTS_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)

ALLOWED_CHANNELS = [
    "Website",
    "Mobile Application",
    "Email",
    "Physical Store",
    "Social Media",
    "Customer Support",
]

ALLOWED_INTERACTION_TYPES = [
    "Page View",
    "Product View",
    "Search",
    "Add to Cart",
    "Purchase",
    "Email Open",
    "Email Click",
    "App Open",
    "Store Visit",
    "Customer Support",
    "Product Review",
]

ALLOWED_JOURNEY_STAGES = [
    "Awareness",
    "Consideration",
    "Intent",
    "Conversion",
    "Retention",
]

ALLOWED_SEGMENTS = [
    "High-Value Omnichannel",
    "Digital-First Explorer",
    "Store Loyalist",
    "Occasional Browser",
    "At-Risk Shopper",
]

REQUIRED_COLUMNS = [
    "customer_id",
    "interaction_id",
    "session_id",
    "channel",
    "interaction_type",
    "timestamp",
    "product_category",
    "device_type",
    "location",
    "campaign_source",
    "interaction_duration",
    "purchase_amount",
    "conversion_status",
    "customer_segment",
    "journey_stage",
]
