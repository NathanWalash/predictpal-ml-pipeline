import numpy as np
import pandas as pd
import pytest

from app.core.preprocessing import (
    clean_dataframe_for_training,
    detect_outliers,
    handle_missing,
    handle_outliers,
    validate_ready_for_ml,
)


def test_handle_missing_strategies_and_validation_errors():
    df = pd.DataFrame({"x": [1.0, np.nan, 3.0], "y": [1, 2, 3]})

    filled = handle_missing(df, "x", "mean")
    assert filled["x"].isna().sum() == 0
    assert filled.loc[1, "x"] == pytest.approx(2.0)

    dropped = handle_missing(df, "x", "drop")
    assert len(dropped) == 2

    with pytest.raises(ValueError):
        handle_missing(df, "x", "value")

    with pytest.raises(ValueError):
        handle_missing(df, "x", "unknown")


def test_outlier_detection_and_capping_iqr():
    df = pd.DataFrame({"v": [10, 11, 12, 13, 1000]})

    mask, stats = detect_outliers(df, "v", method="iqr", threshold=1.5)
    assert mask.sum() == 1
    assert stats["outlier_count"] == 1

    capped = handle_outliers(df, "v", action="cap", method="iqr", threshold=1.5)
    assert capped["v"].max() < 1000


def test_clean_dataframe_for_training_standardizes_and_cleans():
    raw = pd.DataFrame(
        {
            " Date ": ["2024-01-03", "2024-01-01", "2024-01-02", "2024-01-02", None],
            " Sales £ ": ["1,000", "900", None, "950", "100"],
            "Temp C": ["10", "11", "12", "12", "13"],
            "Category": ["A", None, "A", "A", "B"],
            "all_empty": [None, None, None, None, None],
        }
    )

    cleaned, report = clean_dataframe_for_training(
        raw,
        date_col=" Date ",
        target_col=" Sales £ ",
        driver_cols=["Temp C", "Category"],
    )

    assert "all_empty" not in cleaned.columns
    assert "date" in cleaned.columns
    assert "sales" in cleaned.columns
    assert "temp_c" in cleaned.columns

    assert pd.api.types.is_datetime64_any_dtype(cleaned["date"])
    assert pd.api.types.is_numeric_dtype(cleaned["sales"])
    assert pd.api.types.is_numeric_dtype(cleaned["temp_c"])

    assert cleaned["date"].isna().sum() == 0
    assert cleaned["sales"].isna().sum() == 0
    assert cleaned["date"].is_monotonic_increasing

    # Duplicate date rows should be resolved
    assert cleaned["date"].duplicated().sum() == 0

    # Category should be filled
    assert cleaned["category"].isna().sum() == 0

    assert report["rows_removed"] >= 1
    assert report["target_nan_after"] == 0
    assert report["ready"]["ready"] is True


def test_clean_dataframe_for_training_driver_outlier_strategy_applies_to_drivers():
    raw = pd.DataFrame(
        {
            "Date": pd.date_range("2024-01-01", periods=5, freq="D"),
            "Sales": [100, 101, 102, 103, 104],
            "Driver Value": [10, 11, 12, 13, 1000],
        }
    )

    kept, _ = clean_dataframe_for_training(
        raw,
        date_col="Date",
        target_col="Sales",
        driver_cols=["Driver Value"],
        outlier_action="keep",
        driver_outlier_action="keep",
        average_daily_drivers_to_weekly=False,
    )
    assert kept["driver_value"].max() == 1000
    assert len(kept) == 5

    capped, _ = clean_dataframe_for_training(
        raw,
        date_col="Date",
        target_col="Sales",
        driver_cols=["Driver Value"],
        outlier_action="keep",
        driver_outlier_action="cap",
        average_daily_drivers_to_weekly=False,
    )
    assert capped["driver_value"].max() < 1000
    assert len(capped) == 5

    removed, _ = clean_dataframe_for_training(
        raw,
        date_col="Date",
        target_col="Sales",
        driver_cols=["Driver Value"],
        outlier_action="keep",
        driver_outlier_action="remove",
        average_daily_drivers_to_weekly=False,
    )
    assert len(removed) == 4


def test_clean_dataframe_for_training_averages_daily_drivers_to_weekly():
    raw = pd.DataFrame(
        {
            "Date": pd.date_range("2024-01-01", periods=8, freq="D"),
            "Sales": [100] * 8,
            "Driver Value": [1, 2, 3, 4, 5, 6, 7, 8],
        }
    )

    cleaned, report = clean_dataframe_for_training(
        raw,
        date_col="Date",
        target_col="Sales",
        driver_cols=["Driver Value"],
        driver_outlier_action="keep",
    )

    # Week ending Sunday for 2024-01-01..2024-01-07 averages to 4.0.
    first_week = cleaned[cleaned["date"] <= pd.Timestamp("2024-01-07")]
    assert first_week["driver_value"].nunique() == 1
    assert first_week["driver_value"].iloc[0] == pytest.approx(4.0)

    # Next week (2024-01-08) remains its own weekly average.
    second_week = cleaned[cleaned["date"] == pd.Timestamp("2024-01-08")]
    assert second_week["driver_value"].iloc[0] == pytest.approx(8.0)
    assert report["driver_weekly_averaging_applied"] is True


def test_validate_ready_for_ml_catches_bad_data():
    bad = pd.DataFrame(
        {
            "target": [1.0, np.nan, 3.0],
            "x": [1.0, np.inf, 2.0],
            "all_nan": [np.nan, np.nan, np.nan],
        }
    )

    result = validate_ready_for_ml(bad, target_column="target", min_rows=5)

    assert result["ready"] is False
    assert any("missing" in err.lower() for err in result["errors"])
    assert any("infinite" in err.lower() for err in result["errors"])
    assert any("entirely" in err.lower() for err in result["errors"])
    assert len(result["warnings"]) == 1
