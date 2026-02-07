from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd


def write_run_artifacts(
    run_dir: Path,
    input_paths: list[Path],
    result: dict,
    frame: pd.DataFrame,
    target_series: pd.Series,
    temp_weekly: pd.Series,
    holidays_weekly: pd.Series,
    forecast_df: pd.DataFrame,
    out_plot: Path,
    forecast_out: Path,
    target_name: str,
    lags: list[int],
    test_size: str | int,
    forecast_horizon: int,
    baseline_model: str,
    ridge_alpha: float,
    seasonal_period: int,
    multi_model: str,
) -> dict:
    run_dir.mkdir(parents=True, exist_ok=True)
    inputs_dir = run_dir / "inputs"
    inputs_dir.mkdir(parents=True, exist_ok=True)
    for path in input_paths:
        if path.exists():
            shutil.copy2(path, inputs_dir / path.name)

    artifacts_dir = run_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    result["test_df"].to_csv(artifacts_dir / "test_predictions.csv", index=False)
    result["importances"].reset_index().rename(
        columns={"index": "feature", 0: "importance"}
    ).to_csv(artifacts_dir / "feature_importance.csv", index=False)
    frame.reset_index().rename(columns={"index": "week_ending"}).to_csv(
        artifacts_dir / "feature_frame.csv", index=False
    )
    target_series.rename(target_name).reset_index().to_csv(
        artifacts_dir / "target_series.csv", index=False
    )
    temp_weekly.rename("temp_mean").reset_index().to_csv(
        artifacts_dir / "temp_weekly.csv", index=False
    )
    holidays_weekly.rename("holiday_count").reset_index().to_csv(
        artifacts_dir / "holiday_weekly.csv", index=False
    )

    forecast_out.parent.mkdir(parents=True, exist_ok=True)
    forecast_df.to_csv(forecast_out, index=False)

    data_summary = {
        "target_name": target_name,
        "date_col": "week_ending",
        "start": str(target_series.index.min().date()),
        "end": str(target_series.index.max().date()),
        "rows": int(target_series.shape[0]),
        "freq": "W-SUN",
    }
    run_settings = {
        "baseline_model": baseline_model,
        "ridge_alpha": ridge_alpha,
        "seasonal_period": seasonal_period,
        "multi_model": multi_model,
        "lags": lags,
        "test_size": test_size,
        "forecast_horizon": forecast_horizon,
    }
    metrics = {
        "baseline_rmse": result["rmse_base"],
        "baseline_mae": result["mae_base"],
        "baseline_walk_forward_rmse": result["wf_rmse_base"],
        "multivariate_rmse": result["rmse_multi"],
        "multivariate_mae": result["mae_multi"],
        "multivariate_walk_forward_rmse": result["wf_rmse_multi"],
        "improvement_pct": result["improvement"],
    }
    outputs = {
        "plot": str(out_plot),
        "forecast_csv": str(forecast_out),
        "test_predictions_csv": str(artifacts_dir / "test_predictions.csv"),
        "feature_importance_csv": str(artifacts_dir / "feature_importance.csv"),
        "feature_frame_csv": str(artifacts_dir / "feature_frame.csv"),
    }
    analysis_result = {
        "data_summary": data_summary,
        "settings": run_settings,
        "metrics": metrics,
        "outputs": outputs,
    }
    analysis_path = run_dir / "analysis_result.json"
    with analysis_path.open("w", encoding="utf-8") as f:
        json.dump(analysis_result, f, indent=2)

    return analysis_result
