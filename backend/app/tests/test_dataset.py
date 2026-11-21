from app.database import init_db
from app.services.data_preprocessing import (
    build_dataset_preview,
    clean_dataset_with_pandas,
    ensure_sample_dataset_registered,
)


def test_sample_dataset_and_cleaning():
    init_db()
    rec = ensure_sample_dataset_registered()
    assert rec["row_count"] >= 1000

    preview = build_dataset_preview(dataset_id="sample-default")
    assert preview["row_count"] >= 1000
    assert preview["column_count"] == 15
    assert preview["total_missing_values"] > 0

    cleaned = clean_dataset_with_pandas(dataset_id="sample-default")
    assert cleaned["missing_values_after"] == 0
    assert cleaned["duplicates_removed"] >= 1
    assert cleaned["cleaned_rows"] >= 1000
