from __future__ import annotations

import pandas as pd

try:
    import holidays as pyholidays
except ImportError:  # pragma: no cover
    pyholidays = None


def coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def build_lagged_frame(series: pd.Series, lags: list[int], prefix: str) -> pd.DataFrame:
    frame = pd.DataFrame(index=series.index)
    for lag in lags:
        frame[f"{prefix}_lag_{lag}"] = series.shift(lag)
    return frame


def build_calendar_features(index: pd.DatetimeIndex) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "cal_month": index.month,
            "cal_quarter": index.quarter,
            "cal_weekofyear": index.isocalendar().week.astype(int),
            "cal_dayofweek": index.dayofweek,
        },
        index=index,
    )


def build_holiday_features(index: pd.DatetimeIndex) -> pd.DataFrame:
    # Count UK holidays per model period (weekly, monthly, etc.).
    daily = pd.date_range(start=index.min(), end=index.max(), freq="D")

    if pyholidays is not None:
        uk_holidays = pyholidays.UK(subdiv="England")
        holiday_daily = pd.Series(
            [1 if day.date() in uk_holidays else 0 for day in daily],
            index=daily,
            name="holiday_count",
        )
    else:
        # Fallback when python-holidays isn't installed.
        from pandas.tseries.holiday import (
            AbstractHolidayCalendar,
            EasterMonday,
            GoodFriday,
            Holiday,
        )

        class UKBankHolidays(AbstractHolidayCalendar):
            rules = [
                Holiday("New Year", month=1, day=1),
                GoodFriday,
                EasterMonday,
                Holiday("Early May", month=5, day=1, offset=pd.DateOffset(weekday=0)),
                Holiday("Christmas", month=12, day=25),
                Holiday("Boxing Day", month=12, day=26),
            ]

        cal = UKBankHolidays()
        holiday_days = cal.holidays(start=daily.min(), end=daily.max())
        holiday_daily = pd.Series(0, index=daily, name="holiday_count")
        holiday_daily.loc[holiday_days] = 1

    freq = pd.infer_freq(index) or "W-SUN"
    period_holidays = holiday_daily.resample(freq).sum()
    period_holidays = period_holidays.reindex(index, fill_value=0).astype(int)
    return period_holidays.to_frame()


def build_driver_lagged_frame(drivers_df: pd.DataFrame, lags: list[int]) -> pd.DataFrame:
    frame = pd.DataFrame(index=drivers_df.index)
    for col in drivers_df.columns:
        for lag in lags:
            frame[f"{col}_lag_{lag}"] = drivers_df[col].shift(lag)
    return frame


def build_feature_frame(
    target_series: pd.Series,
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    lags: list[int],
    driver_lag_cols: list[str] | None = None,
    driver_lags: list[int] | None = None,
) -> pd.DataFrame:
    target_lags = build_lagged_frame(target_series, lags, "target")
    features = [target_lags]
    if drivers_df is not None and not drivers_df.empty:
        features.append(drivers_df)
        lag_cols = [c for c in (driver_lag_cols or []) if c in drivers_df.columns]
        if lag_cols:
            driver_lag_frame = build_driver_lagged_frame(
                drivers_df[lag_cols],
                driver_lags or [1, 2],
            )
            features.append(driver_lag_frame)
    if calendar_df is not None and not calendar_df.empty:
        features.append(calendar_df)

    return pd.concat([target_series.rename("y"), *features], axis=1).dropna()


def build_future_drivers(
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    future_index: pd.DatetimeIndex,
) -> pd.DataFrame:
    frames = []
    if drivers_df is not None and not drivers_df.empty:
        last_values = drivers_df.iloc[-1]
        driver_future = pd.DataFrame(
            [last_values.values] * len(future_index),
            columns=drivers_df.columns,
            index=future_index,
        )
        frames.append(driver_future)
    if calendar_df is not None and not calendar_df.empty:
        cal_future = build_calendar_features(future_index)
        frames.append(cal_future)

    if not frames:
        return pd.DataFrame(index=future_index)

    return pd.concat(frames, axis=1)
