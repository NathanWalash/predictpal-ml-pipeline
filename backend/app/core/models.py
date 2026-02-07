from __future__ import annotations

from typing import Optional

from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge

try:
    import xgboost as xgb
except ImportError:  # pragma: no cover
    xgb = None


def build_gbm(params: Optional[dict] = None) -> GradientBoostingRegressor:
    config = {
        "random_state": 42,
        "n_estimators": 100,
        "learning_rate": 0.1,
        "max_depth": 2,
        "min_samples_leaf": 5,
        "subsample": 0.8,
    }
    if params:
        config.update(params)
    return GradientBoostingRegressor(**config)


def build_xgb(params: Optional[dict] = None) -> "xgb.XGBRegressor":
    if xgb is None:
        raise ImportError("xgboost is required. Install with: pip install xgboost")
    config = {
        "n_estimators": 300,
        "learning_rate": 0.05,
        "max_depth": 3,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_lambda": 1.0,
        "random_state": 42,
        "objective": "reg:squarederror",
    }
    if params:
        config.update(params)
    return xgb.XGBRegressor(**config)


def build_ridge(alpha: float = 1.0) -> Ridge:
    return Ridge(alpha=alpha)


def seasonal_naive_pred(series, period: int):
    return series.shift(period)
