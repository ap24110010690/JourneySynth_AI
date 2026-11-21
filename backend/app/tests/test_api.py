from fastapi.testclient import TestClient

from app.main import app


def test_fastapi_endpoints():
    with TestClient(app) as client:
        r_root = client.get("/")
        assert r_root.status_code == 200
        assert r_root.json()["status"] == "healthy"

        r_health = client.get("/api/health")
        assert r_health.status_code == 200
        assert r_health.json()["sdv_available"] is True

        r_preview = client.get("/api/dataset/preview")
        assert r_preview.status_code == 200
        assert r_preview.json()["row_count"] >= 1000

        r_clean = client.post("/api/dataset/clean", json={"drop_duplicates": True})
        assert r_clean.status_code == 200
        cleaned_id = r_clean.json()["cleaned_dataset_id"]

        r_train = client.post(
            "/api/model/train",
            json={
                "dataset_id": cleaned_id,
                "model_type": "GaussianCopulaSynthesizer",
                "epochs": 5,
                "batch_size": 100,
                "random_seed": 42,
            },
        )
        assert r_train.status_code == 200
        model_id = r_train.json()["model_id"]

        r_gen = client.post(
            "/api/generate",
            json={"model_id": model_id, "num_records": 100, "random_seed": 42},
        )
        assert r_gen.status_code == 200
        synth_id = r_gen.json()["dataset_id"]

        r_val = client.post(
            "/api/validate",
            json={"synthetic_dataset_id": synth_id, "reference_dataset_id": cleaned_id},
        )
        assert r_val.status_code == 200
        assert 0 <= r_val.json()["overall_score"] <= 100

        r_overview = client.get("/api/analytics/overview")
        assert r_overview.status_code == 200
        assert r_overview.json()["total_synthetic_interactions"] >= 100

        r_channels = client.get("/api/analytics/channels")
        assert r_channels.status_code == 200
        assert len(r_channels.json()["channels"]) >= 5

        r_transitions = client.get("/api/analytics/transitions")
        assert r_transitions.status_code == 200
        assert len(r_transitions.json()["transitions"]) > 0

        r_custs = client.get("/api/analytics/customers")
        assert r_custs.status_code == 200
        first_cid = r_custs.json()["customers"][0]["customer_id"]

        r_timeline = client.get(f"/api/analytics/customers/{first_cid}")
        assert r_timeline.status_code == 200
        assert len(r_timeline.json()["timeline"]) >= 1

        r_mt_train = client.post(
            "/api/model-testing/train",
            json={"dataset_id": synth_id, "model_name": "RandomForestClassifier"},
        )
        assert r_mt_train.status_code == 200
        assert "accuracy" in r_mt_train.json()

        r_mt_pred = client.post(
            "/api/model-testing/predict",
            json={
                "previous_interaction_type": "Add to Cart",
                "channel": "Website",
                "customer_segment": "High-Value Omnichannel",
                "journey_stage": "Intent",
                "previous_interactions_count": 3,
                "previous_purchase_amount": 0.0,
                "interaction_duration": 180.0,
            },
        )
        assert r_mt_pred.status_code == 200
        assert "conversion_probability" in r_mt_pred.json()

        r_export = client.get(f"/api/export/{synth_id}")
        assert r_export.status_code == 200
        assert "customer_id" in r_export.text
