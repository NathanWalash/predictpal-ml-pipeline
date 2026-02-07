import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.data_io import load_weekly_holidays, load_weekly_temp
from app.core.features import build_lagged_frame
from app.core.paths import INPUTS_DIR, OUTPUTS_DIR
from app.core.training import train_and_forecast


def main() -> None:
    input_path = INPUTS_DIR / "2015.06.28-AE-TimeseriesBaG87.cleaned.csv"
    df = pd.read_csv(input_path)
    date_col = "week_ending"
    target_col = "Total Attendances"

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col]).sort_values(date_col)

    start = df[date_col].min()
    end = df[date_col].max()
    temp_weekly = load_weekly_temp(INPUTS_DIR / "meantemp_daily_totals.txt", start, end)
    holidays_weekly = load_weekly_holidays(start, end)
    temp_lags = build_lagged_frame(temp_weekly, [1, 2], "temp_mean")

    drivers_df = pd.concat(
        [
            temp_weekly.rename("temp_mean"),
            temp_lags,
            holidays_weekly.rename("holiday_count"),
        ],
        axis=1,
    )

    df = df.set_index(date_col).join(drivers_df, how="left").reset_index()

    result = train_and_forecast(
        df=df,
        project_id="sanity",
        date_col=date_col,
        target_col=target_col,
        drivers=["temp_mean", "temp_mean_lag_1", "temp_mean_lag_2", "holiday_count"],
        horizon=8,
        baseline_model="lagged_ridge",
        multivariate_model="gbm",
        lag_config="1,2,3,4",
        auto_select_lags=False,
        test_window_weeks=48,
        validation_mode="walk_forward",
        calendar_features=False,
        holiday_features=False,
        output_dir=OUTPUTS_DIR,
        input_paths=[input_path, INPUTS_DIR / "meantemp_daily_totals.txt"],
    )

    metrics = result.get("metrics", {})
    outputs = result.get("outputs", {})

    print("Sanity run complete")
    print(f"baseline_rmse: {metrics.get('baseline_rmse', 0):,.0f}")
    print(f"multivariate_rmse: {metrics.get('multivariate_rmse', 0):,.0f}")
    print("Outputs:")
    for key, value in outputs.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
