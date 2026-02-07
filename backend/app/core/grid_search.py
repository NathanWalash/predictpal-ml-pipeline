from __future__ import annotations

from typing import Optional

import pandas as pd

from app.core.evaluation import evaluate_metrics
from app.core.features import build_feature_frame


def grid_search_lags(
    target_series: pd.Series,
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    lag_sets: list[list[int]],
    test_size: str | int,
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
    gbm_params: Optional[dict] = None,
) -> list[dict]:
    results = []
    for lag_set in lag_sets:
        frame = build_feature_frame(target_series, drivers_df, calendar_df, lag_set)
        metrics = evaluate_metrics(
            frame,
            lag_set,
            test_size,
            gbm_params,
            baseline_model=baseline_model,
            ridge_alpha=ridge_alpha,
            seasonal_period=seasonal_period,
            multi_model=multi_model,
        )
        results.append({"lags": lag_set, **metrics})

    return sorted(results, key=lambda item: item["wf_rmse_multi"])


def grid_search_gbm(
    frame: pd.DataFrame,
    lags: list[int],
    test_size: str | int,
    gbm_grid: list[dict],
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
) -> list[dict]:
    results = []
    for params in gbm_grid:
        metrics = evaluate_metrics(
            frame,
            lags,
            test_size,
            params,
            baseline_model=baseline_model,
            ridge_alpha=ridge_alpha,
            seasonal_period=seasonal_period,
            multi_model=multi_model,
        )
        results.append({"params": params, **metrics})

    return sorted(results, key=lambda item: item["wf_rmse_multi"])
