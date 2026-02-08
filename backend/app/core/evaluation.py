from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from app.core.metrics import rmse, mae, parse_test_size
from app.core.models import build_gbm, build_xgb, build_ridge, seasonal_naive_pred


def _nrmse_pct(y_true: np.ndarray, rmse_value: float) -> float:
    denom = float(np.mean(np.abs(y_true)))
    if denom <= 1e-12:
        return 0.0
    return float((rmse_value / denom) * 100.0)


def walk_forward_rmse(
    frame: pd.DataFrame,
    baseline_features: list[str],
    multivariate_features: list[str],
    min_train_size: int,
    gbm_params: Optional[dict] = None,
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
) -> tuple[float, float]:
    preds_base = []
    preds_multi = []
    actuals = []
    for i in range(min_train_size, len(frame)):
        train = frame.iloc[:i]
        test = frame.iloc[i : i + 1]
        if test.empty:
            break
        if baseline_model == "seasonal_naive":
            idx = i - seasonal_period
            if idx < 0:
                continue
            base_pred = frame["y"].iloc[idx]
        else:
            base_model = build_ridge(ridge_alpha)
            base_model.fit(
                train[baseline_features].to_numpy(), train["y"].to_numpy()
            )
            base_pred = base_model.predict(test[baseline_features].to_numpy())[0]

        if multi_model == "xgb":
            model = build_xgb(gbm_params)
        else:
            model = build_gbm(gbm_params)
        model.fit(train[multivariate_features].to_numpy(), train["y"].to_numpy())
        multi_pred = model.predict(test[multivariate_features].to_numpy())[0]

        preds_base.append(base_pred)
        preds_multi.append(multi_pred)
        actuals.append(test["y"].iloc[0])
    actuals_arr = np.array(actuals)
    return (
        rmse(actuals_arr, np.array(preds_base)),
        rmse(actuals_arr, np.array(preds_multi)),
    )


def evaluate_metrics(
    frame: pd.DataFrame,
    lags: list[int],
    test_size: str | int,
    gbm_params: Optional[dict] = None,
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
) -> dict:
    test_len = parse_test_size(test_size, len(frame))
    train = frame.iloc[:-test_len]
    test = frame.iloc[-test_len:]

    baseline_features = [col for col in frame.columns if col.startswith("target_lag_")]
    multivariate_features = [col for col in frame.columns if col != "y"]

    x_train_base = train[baseline_features].to_numpy()
    x_test_base = test[baseline_features].to_numpy()

    x_train = train[multivariate_features].to_numpy()
    y_train = train["y"].to_numpy()
    x_test = test[multivariate_features].to_numpy()
    y_test = test["y"].to_numpy()

    if baseline_model == "seasonal_naive":
        y_pred_base = seasonal_naive_pred(frame["y"], seasonal_period).loc[test.index]
        base_mask = ~y_pred_base.isna()
        if not base_mask.all():
            y_pred_base = y_pred_base[base_mask]
            y_test = y_test[base_mask.to_numpy()]
            x_test = x_test[base_mask.to_numpy()]
            x_test_base = x_test_base[base_mask.to_numpy()]
    else:
        base_model = build_ridge(ridge_alpha)
        base_model.fit(x_train_base, y_train)
        y_pred_base = base_model.predict(x_test_base)

    if multi_model == "xgb":
        model = build_xgb(gbm_params)
    else:
        model = build_gbm(gbm_params)
    model.fit(x_train, y_train)
    y_pred_multi = model.predict(x_test)

    rmse_base = rmse(y_test, y_pred_base)
    rmse_multi = rmse(y_test, y_pred_multi)
    nrmse_base_pct = _nrmse_pct(y_test, rmse_base)
    nrmse_multi_pct = _nrmse_pct(y_test, rmse_multi)
    mae_base = mae(y_test, y_pred_base)
    mae_multi = mae(y_test, y_pred_multi)
    improvement = (rmse_base - rmse_multi) / rmse_base * 100

    min_train_size = max(20, max(lags) + 2, 8)
    wf_rmse_base, wf_rmse_multi = walk_forward_rmse(
        frame,
        baseline_features,
        multivariate_features,
        min_train_size,
        gbm_params,
        baseline_model,
        ridge_alpha,
        seasonal_period,
        multi_model,
    )

    return {
        "test_len": test_len,
        "rmse_base": rmse_base,
        "rmse_multi": rmse_multi,
        "nrmse_base_pct": nrmse_base_pct,
        "nrmse_multi_pct": nrmse_multi_pct,
        "mae_base": mae_base,
        "mae_multi": mae_multi,
        "improvement": improvement,
        "wf_rmse_base": wf_rmse_base,
        "wf_rmse_multi": wf_rmse_multi,
    }


def evaluate_split(
    frame: pd.DataFrame,
    lags: list[int],
    test_size: str | int,
    gbm_params: Optional[dict] = None,
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
) -> dict:
    test_len = parse_test_size(test_size, len(frame))
    train = frame.iloc[:-test_len]
    test = frame.iloc[-test_len:]

    baseline_features = [col for col in frame.columns if col.startswith("target_lag_")]
    multivariate_features = [col for col in frame.columns if col != "y"]

    x_train_base = train[baseline_features].to_numpy()
    x_test_base = test[baseline_features].to_numpy()

    x_train = train[multivariate_features].to_numpy()
    y_train = train["y"].to_numpy()
    x_test = test[multivariate_features].to_numpy()
    y_test = test["y"].to_numpy()

    test_index = test.index
    if baseline_model == "seasonal_naive":
        y_pred_base = seasonal_naive_pred(frame["y"], seasonal_period).loc[test.index]
        base_mask = ~y_pred_base.isna()
        if not base_mask.all():
            y_pred_base = y_pred_base[base_mask]
            y_test = y_test[base_mask.to_numpy()]
            x_test = x_test[base_mask.to_numpy()]
            x_test_base = x_test_base[base_mask.to_numpy()]
            test_index = test.index[base_mask.to_numpy()]
    else:
        base_model = build_ridge(ridge_alpha)
        base_model.fit(x_train_base, y_train)
        y_pred_base = base_model.predict(x_test_base)

    if multi_model == "xgb":
        model = build_xgb(gbm_params)
    else:
        model = build_gbm(gbm_params)
    model.fit(x_train, y_train)
    y_pred_multi = model.predict(x_test)

    rmse_base = rmse(y_test, y_pred_base)
    rmse_multi = rmse(y_test, y_pred_multi)
    nrmse_base_pct = _nrmse_pct(y_test, rmse_base)
    nrmse_multi_pct = _nrmse_pct(y_test, rmse_multi)
    mae_base = mae(y_test, y_pred_base)
    mae_multi = mae(y_test, y_pred_multi)
    improvement = (rmse_base - rmse_multi) / rmse_base * 100

    min_train_size = max(20, max(lags) + 2, 8)
    wf_rmse_base, wf_rmse_multi = walk_forward_rmse(
        frame,
        baseline_features,
        multivariate_features,
        min_train_size,
        gbm_params,
        baseline_model,
        ridge_alpha,
        seasonal_period,
        multi_model,
    )

    importances = pd.Series(model.feature_importances_, index=multivariate_features)
    importances = importances.sort_values(ascending=False)

    return {
        "test_len": test_len,
        "test_index": test_index,
        "y_test": y_test,
        "y_pred_base": y_pred_base,
        "y_pred_multi": y_pred_multi,
        "rmse_base": rmse_base,
        "rmse_multi": rmse_multi,
        "nrmse_base_pct": nrmse_base_pct,
        "nrmse_multi_pct": nrmse_multi_pct,
        "mae_base": mae_base,
        "mae_multi": mae_multi,
        "improvement": improvement,
        "wf_rmse_base": wf_rmse_base,
        "wf_rmse_multi": wf_rmse_multi,
        "importances": importances,
        "baseline_features": baseline_features,
        "multivariate_features": multivariate_features,
    }
