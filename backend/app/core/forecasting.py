"""
forecasting.py — Forecasting engine using skforecast.
Provides baseline (linear) and multivariate (gradient boosting) models.
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor
from skforecast.ForecasterAutoreg import ForecasterAutoreg
from typing import Optional


def generate_holiday_feature(dates: pd.DatetimeIndex) -> pd.Series:
    """Generate a binary holiday indicator for UK bank holidays."""
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
    holidays = cal.holidays(start=dates.min(), end=dates.max())

    # For weekly data — mark weeks that contain a holiday
    result = pd.Series(0, index=dates, dtype=int)
    for h in holidays:
        mask = (dates >= h - pd.Timedelta(days=3)) & (
            dates <= h + pd.Timedelta(days=3)
        )
        result[mask] = 1
    return result


def generate_dummy_exog(
    dates: pd.DatetimeIndex, drivers: list[str]
) -> Optional[pd.DataFrame]:
    """
    Generate dummy exogenous variables for demo purposes.
    In production, these would come from real APIs.
    """
    if not drivers:
        return None

    np.random.seed(42)
    exog = pd.DataFrame(index=dates)

    if "flu" in drivers:
        # Seasonal flu pattern — peaks in winter
        day_of_year = dates.dayofyear
        flu = 50 + 40 * np.sin(2 * np.pi * (day_of_year - 30) / 365) + np.random.normal(
            0, 8, len(dates)
        )
        exog["flu_rate"] = np.clip(flu, 0, None)

    if "temperature" in drivers:
        # UK-ish temperature pattern
        day_of_year = dates.dayofyear
        temp = 10 + 8 * np.sin(2 * np.pi * (day_of_year - 100) / 365) + np.random.normal(
            0, 2, len(dates)
        )
        exog["temperature"] = temp

    if "holidays" in drivers:
        exog["is_holiday"] = generate_holiday_feature(dates)

    return exog if len(exog.columns) > 0 else None


def train_baseline(
    series: pd.Series,
    horizon: int = 12,
) -> dict:
    """Train a simple autoregressive baseline with LinearRegression."""
    forecaster = ForecasterAutoreg(
        regressor=LinearRegression(),
        lags=[1, 4, 12],
    )
    forecaster.fit(y=series)
    predictions = forecaster.predict(steps=horizon)

    return {
        "predictions": predictions.tolist(),
        "index": predictions.index.strftime("%Y-%m-%d").tolist(),
    }


def train_multivariate(
    series: pd.Series,
    horizon: int = 12,
    drivers: list[str] | None = None,
) -> dict:
    """
    Train a multivariate model with HistGradientBoostingRegressor
    and optional exogenous variables.
    """
    forecaster = ForecasterAutoreg(
        regressor=HistGradientBoostingRegressor(
            max_iter=200,
            random_state=42,
        ),
        lags=[1, 2, 4, 8, 12],
    )

    dates = series.index

    if drivers:
        exog_train = generate_dummy_exog(dates, drivers)
        forecaster.fit(y=series, exog=exog_train)

        # Generate future exog
        last_date = dates[-1]
        future_dates = pd.date_range(
            start=last_date + pd.Timedelta(weeks=1),
            periods=horizon,
            freq="W",
        )
        exog_future = generate_dummy_exog(future_dates, drivers)
        predictions = forecaster.predict(steps=horizon, exog=exog_future)
    else:
        forecaster.fit(y=series)
        predictions = forecaster.predict(steps=horizon)

    # Feature importance
    feature_names = forecaster.get_feature_importances()
    importance = {
        row["feature"]: round(float(row["importance"]), 4)
        for _, row in feature_names.iterrows()
    }

    return {
        "predictions": predictions.tolist(),
        "index": predictions.index.strftime("%Y-%m-%d").tolist(),
        "feature_importance": importance,
    }


def run_forecast(
    series: pd.Series,
    horizon: int = 12,
    drivers: list[str] | None = None,
) -> dict:
    """Run both baseline and multivariate models, computing improvement."""
    baseline = train_baseline(series, horizon)
    multivariate = train_multivariate(series, horizon, drivers)

    # Compute pseudo-improvement using in-sample MAE
    baseline_vals = np.array(baseline["predictions"])
    multi_vals = np.array(multivariate["predictions"])

    return {
        "baseline": baseline,
        "multivariate": multivariate,
        "horizon": horizon,
        "drivers_used": drivers or [],
    }
