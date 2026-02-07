import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.api import endpoints


def test_train_uses_uploaded_driver_data_when_processed_drivers_missing(monkeypatch):
    client = TestClient(app)
    project_id = "proj-driver-train"

    main_df = pd.DataFrame(
        {
            "Date": pd.date_range("2024-01-07", periods=30, freq="W-SUN"),
            "Target": [100 + i for i in range(30)],
        }
    )
    raw_driver_df = pd.DataFrame(
        {
            "Driver Date": pd.date_range("2024-01-01", periods=220, freq="D"),
            "Driver A": [20 + (i % 7) for i in range(220)],
        }
    )

    endpoints._dataframes[project_id] = main_df
    endpoints._driver_dataframes[project_id] = raw_driver_df
    endpoints._processed_dataframes.pop(project_id, None)
    endpoints._processed_driver_dataframes.pop(project_id, None)

    captured: dict = {}

    def fake_train_and_forecast(**kwargs):
        captured["drivers"] = kwargs["drivers"]
        captured["columns"] = kwargs["df"].columns.tolist()
        return {
            "baseline": {"predictions": [], "index": []},
            "multivariate": {"predictions": [], "index": [], "feature_importance": {}},
            "horizon": kwargs["horizon"],
            "drivers_used": kwargs["drivers"],
        }

    monkeypatch.setattr(endpoints, "train_and_forecast", fake_train_and_forecast)

    response = client.post(
        "/api/train",
        json={
            "project_id": project_id,
            "date_col": "Date",
            "target_col": "Target",
            "drivers": ["Driver A"],
            "horizon": 8,
            "baseline_model": "lagged_ridge",
            "multivariate_model": "gbm",
        },
    )

    assert response.status_code == 200, response.text
    assert captured["drivers"] == ["Driver A"]
    assert "Driver A" in captured["columns"]

