from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.core.features import coerce_numeric

try:
    import holidays
except ImportError:  # pragma: no cover
    holidays = None


def load_target(path: Path, target: str) -> pd.Series:
    df = pd.read_csv(path)
    df["week_ending"] = pd.to_datetime(df["week_ending"], errors="coerce")
    df = df.dropna(subset=["week_ending"]).sort_values("week_ending")

    if target not in df.columns:
        raise ValueError(f"Target column not found: {target}")

    df[target] = coerce_numeric(df[target])
    df = df.dropna(subset=[target])

    return df.set_index("week_ending")[target]


def load_weekly_temp(path: Path, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    df = pd.read_csv(
        path,
        sep=r"\s+",
        engine="python",
        comment=None,
        skip_blank_lines=True,
    )
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["value"] = coerce_numeric(df["value"])
    df = df.dropna(subset=["date", "value"]).set_index("date")

    weekly = df.loc[start:end].resample("W-SUN").mean()
    weekly = weekly.rename(columns={"value": "temp_mean"})
    return weekly["temp_mean"]


def load_weekly_holidays(start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    if holidays is None:
        raise ImportError(
            "python-holidays is required. Install with: pip install holidays"
        )

    uk_holidays = holidays.UK(subdiv="England")
    days = pd.date_range(start=start, end=end, freq="D")
    is_holiday = [1 if day.date() in uk_holidays else 0 for day in days]
    daily = pd.Series(is_holiday, index=days, name="holiday")
    weekly = daily.resample("W-SUN").sum()
    weekly.name = "holiday_count"
    return weekly
