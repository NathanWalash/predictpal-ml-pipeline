from __future__ import annotations

from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt
import pandas as pd

from app.core.metrics import rmse, mae, parse_test_size
from app.core.models import build_gbm, build_xgb, build_ridge, seasonal_naive_pred
from app.core.evaluation import walk_forward_rmse


def evaluate_with_plot(
    frame: pd.DataFrame,
    target_series: pd.Series,
    lags: list[int],
    test_size: str | int,
    out_path: Path | None,
    target_name: str,
    multivariate_override: Optional[list[str]] = None,
    gbm_params: Optional[dict] = None,
    baseline_model: str = "lagged_ridge",
    ridge_alpha: float = 1.0,
    seasonal_period: int = 52,
    multi_model: str = "gbm",
) -> dict:
    test_len = parse_test_size(test_size, len(frame))
    train = frame.iloc[:-test_len]
    test = frame.iloc[-test_len:]
    split_date = test.index.min()

    baseline_features = [col for col in frame.columns if col.startswith("target_lag_")]
    multivariate_features = [col for col in frame.columns if col != "y"]
    if multivariate_override is not None:
        multivariate_features = multivariate_override
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

    fig, axes = plt.subplots(3, 1, figsize=(12, 10), sharex=False)

    axes[0].plot(target_series.index, target_series, color="#1f77b4")
    axes[0].set_title("Raw weekly series")
    axes[0].set_ylabel(target_name)
    axes[0].set_xlim(target_series.index.min(), target_series.index.max())
    axes[0].axvline(split_date, color="#666666", linestyle="--", linewidth=1)
    axes[0].text(
        split_date,
        axes[0].get_ylim()[1],
        "test start",
        ha="left",
        va="top",
        fontsize=9,
        color="#666666",
    )

    axes[1].plot(test_index, y_test, label="actual", color="#1f77b4")
    axes[1].plot(test_index, y_pred_base, label="baseline", color="#ff7f0e")
    axes[1].plot(test_index, y_pred_multi, label="multivariate", color="#2ca02c")
    axes[1].set_title(
        "Baseline vs multivariate "
        f"(RMSE: {rmse_base:,.0f} -> {rmse_multi:,.0f}, {improvement:.1f}% better; "
        f"walk-forward: {wf_rmse_base:,.0f} -> {wf_rmse_multi:,.0f})"
    )
    axes[1].set_ylabel(target_name)
    axes[1].legend()
    axes[1].set_xlim(test_index.min(), test_index.max())
    axes[1].axvline(split_date, color="#666666", linestyle="--", linewidth=1)

    residuals = y_test - y_pred_multi
    axes[2].plot(test_index, residuals, color="#9467bd")
    axes[2].axhline(0, color="#666666", linewidth=1)
    axes[2].set_title("Residuals (test, multivariate)")
    axes[2].set_ylabel("actual - predicted")
    axes[2].set_xlim(test_index.min(), test_index.max())
    axes[2].axvline(split_date, color="#666666", linestyle="--", linewidth=1)

    fig.tight_layout()
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(out_path, dpi=150)

    importances = pd.Series(model.feature_importances_, index=multivariate_features)
    importances = importances.sort_values(ascending=False)

    test_df = pd.DataFrame(
        {
            "week_ending": test_index,
            "actual": y_test,
            "baseline": y_pred_base,
            "multivariate": y_pred_multi,
        }
    )

    return {
        "test_len": test_len,
        "split_date": split_date,
        "rmse_base": rmse_base,
        "rmse_multi": rmse_multi,
        "mae_base": mae_base,
        "mae_multi": mae_multi,
        "improvement": improvement,
        "wf_rmse_base": wf_rmse_base,
        "wf_rmse_multi": wf_rmse_multi,
        "importances": importances,
        "out_path": out_path,
        "test_df": test_df,
    }
