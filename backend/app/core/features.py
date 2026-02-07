from __future__ import annotations

import pandas as pd


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
    from pandas.tseries.holiday import (
        AbstractHolidayCalendar,
        GoodFriday,
        EasterMonday,
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
    holidays = cal.holidays(start=index.min(), end=index.max())

    result = pd.Series(0, index=index, dtype=int, name="holiday_count")
    for h in holidays:
        mask = (index >= h - pd.Timedelta(days=3)) & (index <= h + pd.Timedelta(days=3))
        result[mask] = result[mask] + 1
    return result.to_frame()


def build_feature_frame(
    target_series: pd.Series,
    drivers_df: pd.DataFrame | None,
    calendar_df: pd.DataFrame | None,
    lags: list[int],
) -> pd.DataFrame:
    target_lags = build_lagged_frame(target_series, lags, "target")
    features = [target_lags]
    if drivers_df is not None and not drivers_df.empty:
        features.append(drivers_df)
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
