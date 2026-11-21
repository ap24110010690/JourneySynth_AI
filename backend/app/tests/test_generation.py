from app.database import init_db
from app.services.data_preprocessing import clean_dataset_with_pandas, ensure_sample_dataset_registered
from app.services.sdv_generator import generate_synthetic_journeys, train_sdv_model


def test_sdv_training_and_generation():
    init_db()
    ensure_sample_dataset_registered()
    cleaned = clean_dataset_with_pandas(dataset_id="sample-default")

    train_res = train_sdv_model(
        dataset_id=cleaned["cleaned_dataset_id"],
        model_type="GaussianCopulaSynthesizer",
        epochs=5,
        random_seed=42,
    )
    assert train_res["status"] == "trained"
    assert train_res["row_count_trained"] >= 1000

    gen_res = generate_synthetic_journeys(
        model_id=train_res["model_id"],
        num_records=100,
        random_seed=42,
    )
    assert gen_res["num_records"] == 100
    assert gen_res["customer_count"] >= 1
    assert "sequence_diagnostics" in gen_res
