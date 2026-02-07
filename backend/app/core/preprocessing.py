"""
preprocessing.py — Preprocessing utilities for time-series datasets.
"""

from __future__ import annotations

import re
from typing import Optional

import numpy as np
import pandas as pd


# ============== CLEANING ==============

def handle_missing(
    df: pd.DataFrame,
    column: str,
    strategy: str,
    fill_value: Optional[float] = None,
) -> pd.DataFrame:
    """
    Handle missing values in a column.

    Args:
        df: Input DataFrame
        column: Column name to process
        strategy: One of 'drop', 'mean', 'median', 'ffill', 'bfill', 'interpolate', 'value'
        fill_value: Custom value to fill (only used when strategy='value')

    Returns:
        DataFrame with missing values handled (copy, not in-place)

    Raises:
        ValueError: If strategy is unknown
    """
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    result = df.copy()

    if strategy == "drop":
        result = result.dropna(subset=[column])

    elif strategy == "mean":
        mean_val = result[column].mean()
        result[column] = result[column].fillna(mean_val)

    elif strategy == "median":
        median_val = result[column].median()
        result[column] = result[column].fillna(median_val)

    elif strategy == "ffill":
        result[column] = result[column].ffill()

    elif strategy == "bfill":
        result[column] = result[column].bfill()

    elif strategy == "interpolate":
        result[column] = result[column].interpolate(method="linear")

    elif strategy == "value":
        if fill_value is None:
            raise ValueError("fill_value required when strategy='value'")
        result[column] = result[column].fillna(fill_value)

    else:
        raise ValueError(
            f"Unknown strategy: {strategy}. Use 'drop', 'mean', 'median', 'ffill', "
            "'bfill', 'interpolate', or 'value'."
        )

    return result


def detect_outliers(
    df: pd.DataFrame,
    column: str,
    method: str = "iqr",
    threshold: float = 1.5,
) -> tuple[pd.Series, dict]:
    """
    Detect outliers in a column.

    Args:
        df: Input DataFrame
        column: Column name to check
        method: Detection method - 'iqr' or 'zscore'
        threshold: For IQR (default 1.5), for z-score (default 3.0)

    Returns:
        Tuple of (boolean mask where True = outlier, stats dict)
    """
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    values = df[column]

    if method == "iqr":
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr

        mask = (values < lower_bound) | (values > upper_bound)

        stats = {
            "method": "iqr",
            "q1": float(q1),
            "q3": float(q3),
            "iqr": float(iqr),
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound),
            "outlier_count": int(mask.sum()),
            "outlier_pct": round(float(mask.mean() * 100), 2),
        }

    elif method == "zscore":
        if threshold == 1.5:
            threshold = 3.0

        mean = values.mean()
        std = values.std()

        if std == 0 or pd.isna(std):
            mask = pd.Series([False] * len(values), index=values.index)
        else:
            z_scores = np.abs((values - mean) / std)
            mask = z_scores > threshold

        stats = {
            "method": "zscore",
            "mean": float(mean),
            "std": float(std),
            "threshold": float(threshold),
            "outlier_count": int(mask.sum()),
            "outlier_pct": round(float(mask.mean() * 100), 2),
        }

    else:
        raise ValueError(f"Unknown method: {method}. Use 'iqr' or 'zscore'.")

    return mask, stats


def handle_outliers(
    df: pd.DataFrame,
    column: str,
    action: str = "keep",
    method: str = "iqr",
    threshold: float = 1.5,
) -> pd.DataFrame:
    """
    Handle outliers in a column.

    Args:
        df: Input DataFrame
        column: Column name to process
        action: How to handle - 'keep', 'remove', or 'cap'
        method: Detection method - 'iqr' or 'zscore'
        threshold: Detection threshold

    Returns:
        DataFrame with outliers handled (copy, not in-place)
    """
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    result = df.copy()

    if action == "keep":
        return result

    mask, stats = detect_outliers(result, column, method, threshold)

    if action == "remove":
        result = result[~mask].reset_index(drop=True)

    elif action == "cap":
        lower = stats.get("lower_bound")
        upper = stats.get("upper_bound")

        if lower is None:
            mean = stats["mean"]
            std = stats["std"]
            thr = stats["threshold"]
            lower = mean - thr * std
            upper = mean + thr * std

        result[column] = result[column].clip(lower, upper)

    else:
        raise ValueError(f"Unknown action: {action}. Use 'keep', 'remove', or 'cap'.")

    return result


# ============== SCALING ==============

TREE_MODELS = {
    "RandomForest",
    "XGBoost",
    "GradientBoosting",
    "HistGradientBoosting",
    "DecisionTree",
}
LINEAR_MODELS = {"Linear", "Ridge", "Lasso", "ElasticNet", "LogisticRegression"}


def scale_features(
    df: pd.DataFrame,
    columns: list[str],
    method: str = "auto",
    model_type: Optional[str] = None,
) -> tuple[pd.DataFrame, Optional[object]]:
    """
    Scale numeric features.

    Args:
        df: Input DataFrame
        columns: List of column names to scale
        method: 'standard', 'minmax', 'robust', 'none', or 'auto'
        model_type: If provided, auto-selects best scaler for model

    Returns:
        Tuple of (scaled DataFrame, scaler object or None)
    """
    from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

    missing_cols = [c for c in columns if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Columns not found: {missing_cols}")

    result = df.copy()

    if model_type is not None:
        if model_type in TREE_MODELS:
            method = "none"
        elif model_type in LINEAR_MODELS:
            method = "standard"
        else:
            method = "standard"

    if method == "none":
        return result, None

    if method in {"standard", "auto"}:
        scaler = StandardScaler()
    elif method == "minmax":
        scaler = MinMaxScaler()
    elif method == "robust":
        scaler = RobustScaler()
    else:
        raise ValueError(
            f"Unknown method: {method}. Use 'standard', 'minmax', 'robust', or 'none'."
        )

    result[columns] = scaler.fit_transform(result[columns])
    return result, scaler


# ============== FEATURE ENGINEERING ==============

def create_lag_features(df: pd.DataFrame, column: str, lags: list[int]) -> pd.DataFrame:
    """Create lag features for time series forecasting."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    result = df.copy()
    for lag in lags:
        result[f"{column}_lag{lag}"] = result[column].shift(lag)
    return result


def create_rolling_features(
    df: pd.DataFrame,
    column: str,
    windows: list[int],
    stats: list[str] | None = None,
) -> pd.DataFrame:
    """Create rolling window features."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    result = df.copy()
    stats = stats or ["mean"]

    for window in windows:
        for stat in stats:
            col_name = f"{column}_roll{window}_{stat}"
            if stat == "mean":
                result[col_name] = result[column].rolling(window=window).mean()
            elif stat == "std":
                result[col_name] = result[column].rolling(window=window).std()
            elif stat == "min":
                result[col_name] = result[column].rolling(window=window).min()
            elif stat == "max":
                result[col_name] = result[column].rolling(window=window).max()
            elif stat == "sum":
                result[col_name] = result[column].rolling(window=window).sum()
            else:
                raise ValueError(f"Unknown rolling stat: {stat}")
    return result


def create_date_features(df: pd.DataFrame, date_column: str) -> pd.DataFrame:
    """Extract date-based features from a datetime column."""
    if date_column not in df.columns:
        raise ValueError(f"Column '{date_column}' not found")

    result = df.copy()
    dates = pd.to_datetime(result[date_column], errors="coerce")

    result["day_of_week"] = dates.dt.dayofweek
    result["day_of_month"] = dates.dt.day
    result["week_of_year"] = dates.dt.isocalendar().week.astype("Int64")
    result["month"] = dates.dt.month
    result["quarter"] = dates.dt.quarter
    result["year"] = dates.dt.year
    result["is_weekend"] = (dates.dt.dayofweek >= 5).astype("Int64")

    return result


# ============== VALIDATION ==============

def validate_ready_for_ml(
    df: pd.DataFrame,
    target_column: str,
    min_rows: int = 50,
) -> dict:
    """
    Validate that data is ready for ML training.

    Args:
        df: Dataset to validate
        target_column: Name of the target variable
        min_rows: Minimum rows required (default 50)

    Returns:
        Dict with 'ready' (bool), 'errors' (list), 'warnings' (list)
    """
    errors: list[str] = []
    warnings: list[str] = []

    if target_column not in df.columns:
        errors.append(f"Target column '{target_column}' not found")
        return {"ready": False, "errors": errors, "warnings": warnings}

    target_nan = int(df[target_column].isna().sum())
    if target_nan > 0:
        errors.append(f"Target has {target_nan} missing (NaN) values")

    if len(df) < min_rows:
        warnings.append(f"Low data: only {len(df)} rows (recommend {min_rows}+)")

    for col in df.columns:
        if df[col].isna().all():
            errors.append(f"Column '{col}' is entirely NaN")

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if np.isinf(df[col]).any():
            errors.append(f"Column '{col}' contains infinite values")

    ready = len(errors) == 0
    return {
        "ready": ready,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "column_count": len(df.columns),
    }


# ============== PIPELINE ==============

def _normalize_column_name(column_name: str) -> str:
    normalized = column_name.strip().lower()
    normalized = normalized.replace("%", " pct ")
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized or "column"


def _build_column_mapping(columns: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for original in columns:
        base = _normalize_column_name(str(original))
        candidate = base
        idx = 2
        while candidate in used:
            candidate = f"{base}_{idx}"
            idx += 1
        mapping[original] = candidate
        used.add(candidate)
    return mapping


def _resolve_column_name(requested_name: str, mapping: dict[str, str]) -> str:
    if requested_name in mapping:
        return mapping[requested_name]

    if requested_name in mapping.values():
        return requested_name

    normalized = _normalize_column_name(str(requested_name))
    if normalized in mapping.values():
        return normalized

    raise ValueError(f"Column '{requested_name}' not found")


def _coerce_numeric(values: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(values):
        return pd.to_numeric(values, errors="coerce")

    cleaned = (
        values.astype(str)
        .str.replace(r"[£$€,]", "", regex=True)
        .str.replace(r"\s+", "", regex=True)
        .replace({"": np.nan, "nan": np.nan, "None": np.nan, "null": np.nan})
    )
    return pd.to_numeric(cleaned, errors="coerce")


def clean_dataframe_for_training(
    df: pd.DataFrame,
    date_col: str,
    target_col: str,
    driver_cols: Optional[list[str]] = None,
    *,
    outlier_action: str = "cap",
    driver_outlier_action: Optional[str] = None,
    average_daily_drivers_to_weekly: bool = True,
    min_rows: int = 20,
) -> tuple[pd.DataFrame, dict]:
    """
    End-to-end cleaning pipeline for model training.

    Returns:
        Tuple of (cleaned_df, report)
    """
    if df.empty:
        raise ValueError("Input dataframe is empty")

    result = df.copy()
    initial_rows = len(result)
    initial_cols = len(result.columns)

    result = result.dropna(how="all")
    result = result.dropna(axis=1, how="all")

    mapping = _build_column_mapping([str(c) for c in result.columns.tolist()])
    result.columns = [mapping[str(c)] for c in result.columns.tolist()]

    date_col_clean = _resolve_column_name(date_col, mapping)
    target_col_clean = _resolve_column_name(target_col, mapping)

    requested_drivers = driver_cols or []
    driver_cols_clean: list[str] = []
    for col in requested_drivers:
        try:
            resolved = _resolve_column_name(col, mapping)
            if resolved not in {date_col_clean, target_col_clean}:
                driver_cols_clean.append(resolved)
        except ValueError:
            # Ignore unknown driver columns so API can still run with virtual drivers.
            continue

    target_nan_before = int(result[target_col_clean].isna().sum())

    result[date_col_clean] = pd.to_datetime(result[date_col_clean], errors="coerce")
    invalid_dates = int(result[date_col_clean].isna().sum())
    result = result.dropna(subset=[date_col_clean])

    result[target_col_clean] = _coerce_numeric(result[target_col_clean])

    numeric_driver_cols: list[str] = []
    categorical_driver_cols: list[str] = []

    for col in driver_cols_clean:
        candidate_numeric = _coerce_numeric(result[col])
        numeric_ratio = float(candidate_numeric.notna().mean()) if len(result) else 0.0
        if numeric_ratio >= 0.6:
            result[col] = candidate_numeric
            numeric_driver_cols.append(col)
        else:
            result[col] = result[col].astype("string")
            categorical_driver_cols.append(col)

    result = result.sort_values(date_col_clean).reset_index(drop=True)
    result = result.drop_duplicates(subset=[date_col_clean], keep="last").reset_index(
        drop=True
    )

    driver_weekly_averaging_applied = False
    median_gap = result[date_col_clean].diff().dropna().median()
    if (
        average_daily_drivers_to_weekly
        and numeric_driver_cols
        and pd.notna(median_gap)
        and median_gap <= pd.Timedelta(days=2)
    ):
        # Collapse daily volatility in drivers into weekly means while preserving row count.
        week_key = result[date_col_clean].dt.to_period("W-SUN")
        for col in numeric_driver_cols:
            result[col] = result.groupby(week_key)[col].transform("mean")
        driver_weekly_averaging_applied = True

    resolved_driver_outlier_action = driver_outlier_action or outlier_action

    # Fill target with interpolation first, then edge-fill. Any unresolved NaN is dropped.
    result = handle_missing(result, target_col_clean, "interpolate")
    result = handle_missing(result, target_col_clean, "ffill")
    result = handle_missing(result, target_col_clean, "bfill")
    result = handle_missing(result, target_col_clean, "drop")

    for col in numeric_driver_cols:
        result = handle_missing(result, col, "median")
        if resolved_driver_outlier_action != "keep":
            result = handle_outliers(
                result,
                col,
                action=resolved_driver_outlier_action,
                method="iqr",
            )

    for col in categorical_driver_cols:
        result[col] = result[col].fillna("unknown")

    if outlier_action != "keep":
        result = handle_outliers(result, target_col_clean, action=outlier_action, method="iqr")

    target_nan_after = int(result[target_col_clean].isna().sum())
    rows_removed = initial_rows - len(result)
    cols_removed = initial_cols - len(result.columns)

    readiness = validate_ready_for_ml(result, target_column=target_col_clean, min_rows=min_rows)

    report = {
        "column_mapping": mapping,
        "date_col": date_col_clean,
        "target_col": target_col_clean,
        "driver_cols": driver_cols_clean,
        "driver_outlier_action": resolved_driver_outlier_action,
        "driver_weekly_averaging_applied": driver_weekly_averaging_applied,
        "rows_removed": rows_removed,
        "cols_removed": cols_removed,
        "invalid_dates_removed": invalid_dates,
        "target_nan_before": target_nan_before,
        "target_nan_after": target_nan_after,
        "ready": readiness,
    }

    return result, report
