from app.database import init_db
from app.services.data_preprocessing import clean_dataset_with_pandas, ensure_sample_dataset_registered
from app.services.data_validation import validate_synthetic_dataset
from app.services.sdv_generator import generate_synthetic_journeys, train_sdv_model


def test_validation_report_generation():
    init_db()
    ensure_sample_dataset_registered()
    cleaned = clean_dataset_with_pandas(dataset_id="sample-default")
    train_res = train_sdv_model(
        dataset_id=cleaned["cleaned_dataset_id"],
        model_type="GaussianCopulaSynthesizer",
        random_seed=7,
    )
    gen_res = generate_synthetic_journeys(
        model_id=train_res["model_id"],
        num_records=120,
        random_seed=7,
    )
    report = validate_synthetic_dataset(
        synthetic_dataset_id=gen_res["dataset_id"],
        reference_dataset_id=cleaned["cleaned_dataset_id"],
    )
    assert 0 <= report["overall_score"] <= 100
    assert report["completeness"]["missing_values"] == 0
    assert "column_results" in report
    assert "privacy_disclaimer" in report
