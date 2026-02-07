"""
processing.py — Data ingestion & cleaning utilities.
Handles CSV/Excel parsing, date detection, frequency validation.
"""

import pandas as pd
import numpy as np
from typing import Optional


def detect_date_column(df: pd.DataFrame) -> Optional[str]:
    """
    Heuristic to find the column most likely containing dates.
    Returns the column name or None.
    """
    # Try columns with 'date' or 'time' in the name first
    for col in df.columns:
        if any(kw in col.lower() for kw in ["date", "time", "period", "week"]):
            try:
                pd.to_datetime(df[col], infer_datetime_format=True)
                return col
            except (ValueError, TypeError):
                continue

    # Fallback: try parsing every object/string column
    for col in df.select_dtypes(include=["object", "datetime64"]).columns:
        try:
            parsed = pd.to_datetime(df[col], infer_datetime_format=True)
            if parsed.notna().sum() > len(df) * 0.8:
                return col
        except (ValueError, TypeError):
            continue

    return None


def detect_numeric_columns(df: pd.DataFrame) -> list[str]:
    """Return all numeric columns that could be target metrics."""
    return df.select_dtypes(include=[np.number]).columns.tolist()


def validate_frequency(df: pd.DataFrame, date_col: str) -> dict:
    """
    Check the time-series frequency. Returns info about gaps.
    Does NOT auto-impute — user decides.
    """
    dates = pd.to_datetime(df[date_col]).sort_values().reset_index(drop=True)
    diffs = dates.diff().dropna()

    # Detect dominant frequency
    median_diff = diffs.median()

    if pd.Timedelta(days=5) <= median_diff <= pd.Timedelta(days=9):
        freq_label = "weekly"
    elif pd.Timedelta(days=25) <= median_diff <= pd.Timedelta(days=35):
        freq_label = "monthly"
    elif pd.Timedelta(days=0) <= median_diff <= pd.Timedelta(days=2):
        freq_label = "daily"
    else:
        freq_label = "irregular"

    # Find gaps (dates that deviate significantly from median)
    threshold = median_diff * 1.5
    gap_indices = diffs[diffs > threshold].index.tolist()
    missing_ranges = []
    for idx in gap_indices:
        start = dates.iloc[idx - 1]
        end = dates.iloc[idx]
        missing_ranges.append(
            {"from": start.isoformat(), "to": end.isoformat()}
        )

    return {
        "detected_frequency": freq_label,
        "median_gap_days": median_diff.days,
        "total_rows": len(df),
        "missing_ranges": missing_ranges,
        "has_gaps": len(missing_ranges) > 0,
    }


def get_data_health(df: pd.DataFrame) -> dict:
    """Return a summary of data quality issues."""
    health = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": [],
    }
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "missing_count": int(df[col].isna().sum()),
            "missing_pct": round(float(df[col].isna().mean() * 100), 1),
            "unique_count": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            col_info["min"] = float(df[col].min()) if df[col].notna().any() else None
            col_info["max"] = float(df[col].max()) if df[col].notna().any() else None
            col_info["mean"] = (
                round(float(df[col].mean()), 2) if df[col].notna().any() else None
            )
        health["columns"].append(col_info)

    return health


def load_dataframe(file_path: str) -> pd.DataFrame:
    """Load CSV or Excel file into a DataFrame."""
    if file_path.endswith((".xlsx", ".xls")):
        return pd.read_excel(file_path)
    return pd.read_csv(file_path)
