import argparse
from pathlib import Path

import pandas as pd

from app.core.paths import INPUTS_DIR, OUTPUTS_DIR
from app.core.training import train_and_forecast


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run training + forecast with selected model configuration."
    )
    parser.add_argument(
        "--target_csv",
        type=Path,
        default=INPUTS_DIR / "2015.06.28-AE-TimeseriesBaG87.cleaned.csv",
        help="Path to the target CSV",
    )
    parser.add_argument(
        "--date_col",
        type=str,
        default="week_ending",
        help="Date column name",
    )
    parser.add_argument(
        "--target",
        type=str,
        default="Total Attendances",
        help="Target column name",
    )
    parser.add_argument(
        "--drivers",
        type=str,
        default="",
        help="Comma-separated driver column names",
    )
    parser.add_argument(
        "--baseline_model",
        type=str,
        default="lagged_ridge",
        choices=["lagged_ridge", "seasonal_naive"],
        help="Baseline model type",
    )
    parser.add_argument(
        "--multivariate_model",
        type=str,
        default="gbm",
        choices=["gbm", "xgb"],
        help="Multivariate model type",
    )
    parser.add_argument(
        "--lag_config",
        type=str,
        default="1,2,4",
        help="Comma-separated target lags (weeks)",
    )
    parser.add_argument(
        "--auto_select_lags",
        action="store_true",
        help="Run lag grid search and use best lag set",
    )
    parser.add_argument(
        "--test_window_weeks",
        type=int,
        default=48,
        help="Holdout window size in weeks",
    )
    parser.add_argument(
        "--validation_mode",
        type=str,
        default="walk_forward",
        choices=["walk_forward", "single_split"],
        help="Validation mode for selecting best lags",
    )
    parser.add_argument(
        "--calendar_features",
        action="store_true",
        help="Add calendar features",
    )
    parser.add_argument(
        "--forecast_horizon",
        type=int,
        default=8,
        help="Forecast horizon in weeks",
    )
    parser.add_argument(
        "--project_id",
        type=str,
        default="cli",
        help="Project ID prefix for output files",
    )
    parser.add_argument(
        "--output_dir",
        type=Path,
        default=OUTPUTS_DIR,
        help="Output directory for artifacts",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    df = pd.read_csv(args.target_csv)
    drivers = [d.strip() for d in args.drivers.split(",") if d.strip()]

    result = train_and_forecast(
        df=df,
        project_id=args.project_id,
        date_col=args.date_col,
        target_col=args.target,
        drivers=drivers,
        horizon=args.forecast_horizon,
        baseline_model=args.baseline_model,
        multivariate_model=args.multivariate_model,
        lag_config=args.lag_config,
        auto_select_lags=args.auto_select_lags,
        test_window_weeks=args.test_window_weeks,
        validation_mode=args.validation_mode,
        calendar_features=args.calendar_features,
        output_dir=args.output_dir,
    )

    metrics = result.get("metrics", {})
    outputs = result.get("outputs", {})

    print("Run settings:")
    print(f"  baseline_model: {args.baseline_model}")
    print(f"  multivariate_model: {args.multivariate_model}")
    print(f"  lag_config: {args.lag_config}")
    print(f"  auto_select_lags: {args.auto_select_lags}")
    print(f"  test_window_weeks: {args.test_window_weeks}")
    print(f"  validation_mode: {args.validation_mode}")
    print(f"  forecast_horizon: {args.forecast_horizon}")

    if metrics:
        print("Metrics:")
        print(f"  baseline_rmse: {metrics.get('baseline_rmse', 0):,.0f}")
        print(f"  multivariate_rmse: {metrics.get('multivariate_rmse', 0):,.0f}")
        print(f"  baseline_mae: {metrics.get('baseline_mae', 0):,.0f}")
        print(f"  multivariate_mae: {metrics.get('multivariate_mae', 0):,.0f}")
        print(f"  improvement_pct: {metrics.get('improvement_pct', 0):.1f}%")

    if outputs:
        print("Outputs:")
        for key, value in outputs.items():
            print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
