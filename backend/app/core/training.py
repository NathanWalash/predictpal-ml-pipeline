from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from app.core.evaluation import evaluate_split
from app.core.features import (
    build_calendar_features,
    build_holiday_features,
    build_feature_frame,
    build_future_drivers,
    coerce_numeric,
)
from app.core.grid_search import grid_search_lags
from app.core.models import build_gbm, build_xgb, build_ridge
from app.core.paths import OUTPUTS_DIR


def parse_lag_config(value: str) -> list[int]:
    items = [v.strip() for v in value.split(",") if v.strip()]
    lags = [int(item) for item in items]
    if not lags:
        raise ValueError("At least one lag is required")
    return lags


def prepare_series_and_drivers(
    df: pd.DataFrame,
    date_col: str,
    target_col: str,
    drivers: list[str],
    calendar_features: bool,
    holiday_features: bool,
) -> tuple[pd.Series, pd.DataFrame | None, pd.DataFrame | None]:
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col]).sort_values(date_col).reset_index(drop=True)
    df = df.set_index(date_col)

    freq = pd.infer_freq(df.index)
    if freq is None:
        freq = "W"
    df = df.asfreq(freq)

    if target_col not in df.columns:
        raise ValueError(f"Target column not found: {target_col}")

    df[target_col] = coerce_numeric(df[target_col])
    target_series = df[target_col].dropna()

    drivers_df = None
    if drivers:
        driver_cols = [col for col in drivers if col in df.columns]
        if driver_cols:
            drivers_df = df[driver_cols].apply(coerce_numeric).reindex(target_series.index)

    if holiday_features:
        holiday_df = build_holiday_features(target_series.index)
        if drivers_df is None:
            drivers_df = holiday_df
        elif "holiday_count" not in drivers_df.columns:
            drivers_df = pd.concat([drivers_df, holiday_df], axis=1)

    calendar_df = None
    if calendar_features:
        calendar_df = build_calendar_features(target_series.index)

    return target_series, drivers_df, calendar_df


def select_lags(
    target_series: pd.Series,
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    lag_config: str,
    auto_select: bool,
    test_window_weeks: int,
    baseline_model: str,
    ridge_alpha: float,
    seasonal_period: int,
    multi_model: str,
    lag_candidates: Optional[list[list[int]]] = None,
    validation_mode: str = "walk_forward",
) -> tuple[list[int], Optional[dict]]:
    lags = parse_lag_config(lag_config)
    if not auto_select:
        return lags, None

    candidate_sets = lag_candidates or [[1, 2, 4], [1, 2, 3, 4], [1, 3, 6]]
    results = grid_search_lags(
        target_series,
        drivers_df,
        calendar_df,
        candidate_sets,
        test_window_weeks,
        baseline_model=baseline_model,
        ridge_alpha=ridge_alpha,
        seasonal_period=seasonal_period,
        multi_model=multi_model,
    )

    if not results:
        return lags, None

    metric_key = "wf_rmse_multi" if validation_mode == "walk_forward" else "rmse_multi"
    best = min(results, key=lambda item: item[metric_key])
    return best["lags"], {"metric": metric_key, "results": results}


def forecast_future(
    frame: pd.DataFrame,
    target_series: pd.Series,
    lags: list[int],
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    horizon: int,
    baseline_model: str,
    ridge_alpha: float,
    seasonal_period: int,
    multi_model: str,
    gbm_params: Optional[dict] = None,
) -> pd.DataFrame:
    last_date = target_series.index.max()
    future_index = pd.date_range(
        start=last_date + pd.Timedelta(days=7),
        periods=horizon,
        freq="W",
    )

    future_drivers = build_future_drivers(drivers_df, calendar_df, future_index)

    baseline_features = [col for col in frame.columns if col.startswith("target_lag_")]
    multivariate_features = [col for col in frame.columns if col != "y"]

    x_train_base = frame[baseline_features].to_numpy()
    y_train = frame["y"].to_numpy()
    x_train = frame[multivariate_features].to_numpy()

    if baseline_model == "seasonal_naive":
        base_model = None
    else:
        base_model = build_ridge(ridge_alpha)
        base_model.fit(x_train_base, y_train)

    if multi_model == "xgb":
        model = build_xgb(gbm_params)
    else:
        model = build_gbm(gbm_params)
    model.fit(x_train, y_train)

    y_history = list(target_series.values)
    baseline_forecasts = []
    multi_forecasts = []

    for idx in future_index:
        lag_values = [y_history[-lag] for lag in lags]
        base_features = np.array(lag_values, dtype=float).reshape(1, -1)

        if baseline_model == "seasonal_naive":
            if len(y_history) >= seasonal_period:
                base_pred = y_history[-seasonal_period]
            else:
                base_pred = y_history[-1]
        else:
            base_pred = float(base_model.predict(base_features)[0])

        multi_row = {
            **{f"target_lag_{lag}": y_history[-lag] for lag in lags},
            **future_drivers.loc[idx].to_dict(),
        }
        multi_features = np.array(
            [multi_row[col] for col in multivariate_features], dtype=float
        ).reshape(1, -1)
        multi_pred = float(model.predict(multi_features)[0])

        baseline_forecasts.append(base_pred)
        multi_forecasts.append(multi_pred)
        y_history.append(multi_pred)

    return pd.DataFrame(
        {
            "week_ending": future_index,
            "baseline_forecast": baseline_forecasts,
            "multivariate_forecast": multi_forecasts,
        }
    )


def train_and_forecast(
    df: pd.DataFrame,
    project_id: str,
    date_col: str,
    target_col: str,
    drivers: list[str],
    horizon: int,
    baseline_model: str,
    multivariate_model: str,
    lag_config: str,
    auto_select_lags: bool,
    test_window_weeks: int,
    validation_mode: str,
    calendar_features: bool,
    holiday_features: bool = False,
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    gbm_params: Optional[dict] = None,
    output_dir: Optional[Path] = None,
    input_paths: Optional[list[Path]] = None,
) -> dict:
    run_dir = output_dir or OUTPUTS_DIR
    run_dir.mkdir(parents=True, exist_ok=True)

    target_series, drivers_df, calendar_df = prepare_series_and_drivers(
        df,
        date_col,
        target_col,
        drivers,
        calendar_features,
        holiday_features,
    )

    if len(target_series) < 20:
        raise ValueError("Need at least 20 data points to train a model")

    lags, lag_search = select_lags(
        target_series,
        drivers_df,
        calendar_df,
        lag_config,
        auto_select_lags,
        test_window_weeks,
        baseline_model,
        ridge_alpha,
        seasonal_period,
        multivariate_model,
        validation_mode=validation_mode,
    )

    frame = build_feature_frame(target_series, drivers_df, calendar_df, lags)

    eval_result = evaluate_split(
        frame,
        lags,
        test_window_weeks,
        gbm_params,
        baseline_model=baseline_model,
        ridge_alpha=ridge_alpha,
        seasonal_period=seasonal_period,
        multi_model=multivariate_model,
    )

    forecast_df = forecast_future(
        frame,
        target_series,
        lags,
        drivers_df,
        calendar_df,
        horizon,
        baseline_model,
        ridge_alpha,
        seasonal_period,
        multivariate_model,
        gbm_params,
    )

    test_df = pd.DataFrame(
        {
            "week_ending": eval_result["test_index"],
            "actual": eval_result["y_test"],
            "baseline": eval_result["y_pred_base"],
            "multivariate": eval_result["y_pred_multi"],
        }
    )

    if input_paths:
        inputs_dir = run_dir / "inputs"
        inputs_dir.mkdir(parents=True, exist_ok=True)
        for path in input_paths:
            if path.exists():
                shutil.copy2(path, inputs_dir / path.name)

    artifacts_dir = run_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    forecast_path = run_dir / "forecast.csv"
    test_path = artifacts_dir / "test_predictions.csv"
    importance_path = artifacts_dir / "feature_importance.csv"
    feature_frame_path = artifacts_dir / "feature_frame.csv"
    analysis_path = run_dir / "analysis_result.json"

    forecast_df.to_csv(forecast_path, index=False)
    test_df.to_csv(test_path, index=False)
    eval_result["importances"].reset_index().rename(
        columns={"index": "feature", 0: "importance"}
    ).to_csv(importance_path, index=False)
    frame.reset_index().rename(columns={"index": "week_ending"}).to_csv(
        feature_frame_path, index=False
    )

    metrics = {
        "baseline_rmse": eval_result["rmse_base"],
        "baseline_mae": eval_result["mae_base"],
        "baseline_walk_forward_rmse": eval_result["wf_rmse_base"],
        "multivariate_rmse": eval_result["rmse_multi"],
        "multivariate_mae": eval_result["mae_multi"],
        "multivariate_walk_forward_rmse": eval_result["wf_rmse_multi"],
        "improvement_pct": eval_result["improvement"],
    }

    outputs = {
        "forecast_csv": str(forecast_path),
        "test_predictions_csv": str(test_path),
        "feature_importance_csv": str(importance_path),
        "feature_frame_csv": str(feature_frame_path),
        "analysis_json": str(analysis_path),
    }

    settings = {
        "baseline_model": baseline_model,
        "multivariate_model": multivariate_model,
        "lags": lags,
        "test_window_weeks": test_window_weeks,
        "validation_mode": validation_mode,
        "forecast_horizon": horizon,
        "calendar_features": calendar_features,
        "auto_select_lags": auto_select_lags,
    }

    if lag_search:
        settings["lag_search"] = lag_search

    analysis_result = {
        "generated_at": datetime.utcnow().isoformat(),
        "settings": settings,
        "metrics": metrics,
        "outputs": outputs,
    }
    with analysis_path.open("w", encoding="utf-8") as f:
        json.dump(analysis_result, f, indent=2)

    return {
        "baseline": {
            "predictions": forecast_df["baseline_forecast"].tolist(),
            "index": forecast_df["week_ending"].dt.strftime("%Y-%m-%d").tolist(),
        },
        "multivariate": {
            "predictions": forecast_df["multivariate_forecast"].tolist(),
            "index": forecast_df["week_ending"].dt.strftime("%Y-%m-%d").tolist(),
            "feature_importance": eval_result["importances"].to_dict(),
        },
        "historical": {
            "values": target_series.tolist(),
            "index": target_series.index.strftime("%Y-%m-%d").tolist(),
        },
        "horizon": horizon,
        "drivers_used": drivers,
        "metrics": metrics,
        "outputs": outputs,
        "settings": settings,
        "test_predictions": {
            "index": test_df["week_ending"].dt.strftime("%Y-%m-%d").tolist(),
            "actual": test_df["actual"].tolist(),
            "baseline": test_df["baseline"].tolist(),
            "multivariate": test_df["multivariate"].tolist(),
        },
    }
