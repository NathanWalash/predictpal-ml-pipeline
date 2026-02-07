"""
endpoints.py — All FastAPI routes.
Upload, Analyze, Train, Chat, Auth, Projects.
"""

import os
import uuid
import hashlib
import tempfile
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import pandas as pd
from pydantic import BaseModel
import pandas as pd

from app.core.processing import (
    detect_date_column,
    detect_numeric_columns,
    parse_datetime_series,
    validate_frequency,
    get_data_health,
    load_dataframe,
    get_preview,
)
from app.core.training import train_and_forecast
from app.core.preprocessing import clean_dataframe_for_training
from app.core.gemini import generate_chat_response
from app.core.paths import OUTPUTS_DIR

router = APIRouter()

# In-memory stores for demo
_projects: dict = {}
_dataframes: dict = {}
_processed_dataframes: dict = {}  # project_id -> cleaned DataFrame from Step 2
_processed_driver_dataframes: dict = {}  # project_id -> cleaned/resampled driver DataFrame
_driver_dataframes: dict = {}  # project_id -> driver DataFrame
_driver_file_names: dict = {}  # project_id -> uploaded driver filename
_users: dict = {}  # username -> {password_hash, user_id}
_user_projects: dict = {}  # user_id -> [project_ids]
_analysis_dir = OUTPUTS_DIR


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _username_for_user_id(user_id: str | None) -> str:
    if not user_id:
        return "anonymous"
    for username, payload in _users.items():
        if payload.get("user_id") == user_id:
            return username
    return "anonymous"


def _string_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    items: list[str] = []
    for item in raw:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            items.append(text)
    return items


def _story_card(project: dict[str, Any]) -> dict[str, Any]:
    config = project.get("config") if isinstance(project.get("config"), dict) else {}
    categories = _string_list(config.get("categories"))
    notebook_blocks = config.get("notebook_blocks")
    block_count = len(notebook_blocks) if isinstance(notebook_blocks, list) else 0
    author = _username_for_user_id(project.get("user_id"))
    if author == "anonymous":
        config_author = str(config.get("author_username") or "").strip()
        if config_author:
            author = config_author
    cover_graph = None
    if isinstance(notebook_blocks, list):
        for block in notebook_blocks:
            if isinstance(block, dict) and block.get("type") == "graph":
                cover_graph = block.get("assetId")
                break

    return {
        "story_id": project.get("project_id"),
        "project_id": project.get("project_id"),
        "title": config.get("headline") or project.get("title") or "Untitled Story",
        "description": config.get("description") or project.get("description") or "",
        "author": author,
        "user_id": project.get("user_id"),
        "categories": categories,
        "published_at": project.get("published_at"),
        "created_at": project.get("created_at"),
        "use_case": project.get("use_case") or "",
        "horizon": config.get("horizon"),
        "baseline_model": config.get("baselineModel"),
        "multivariate_model": config.get("multivariateModel"),
        "drivers": _string_list(config.get("drivers")),
        "block_count": block_count,
        "cover_graph": cover_graph,
        "source": "user",
        "is_debug": False,
    }


def _resolve_analysis_path(path_value: str, fallback: str) -> Path:
    raw = path_value or fallback
    raw_path = Path(raw)
    candidate = raw_path.resolve() if raw_path.is_absolute() else (_analysis_dir / raw_path).resolve()
    if not str(candidate).startswith(str(_analysis_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid analysis file path")
    return candidate


def _resolve_analysis_path_multi(path_value: str, fallbacks: list[str]) -> Path:
    if path_value:
        return _resolve_analysis_path(path_value, fallbacks[0])
    for fallback in fallbacks:
        candidate = _resolve_analysis_path("", fallback)
        if candidate.exists():
            return candidate
    return _resolve_analysis_path("", fallbacks[0])


def _csv_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    df = pd.read_csv(path)
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%d")
    return df.where(pd.notna(df), None).to_dict(orient="records")


def _resolve_df_column(df: pd.DataFrame, requested: str, label: str) -> str:
    if requested in df.columns:
        return requested

    direct_lower = {str(col).lower(): str(col) for col in df.columns}
    requested_lower = str(requested).lower()
    if requested_lower in direct_lower:
        return direct_lower[requested_lower]

    normalized = "".join(ch if ch.isalnum() else "_" for ch in requested_lower)
    normalized = "_".join(part for part in normalized.split("_") if part)
    normalized_map = {}
    for col in df.columns:
        key = "".join(ch if ch.isalnum() else "_" for ch in str(col).lower())
        key = "_".join(part for part in key.split("_") if part)
        normalized_map[key] = str(col)
    if normalized in normalized_map:
        return normalized_map[normalized]

    raise HTTPException(
        status_code=400,
        detail=f"Training {label} column '{requested}' not found in processed data columns {df.columns.tolist()}",
    )


def _resolve_optional_df_column(df: pd.DataFrame, requested: str) -> str | None:
    try:
        return _resolve_df_column(df, requested, "driver")
    except HTTPException:
        return None


# ─── Auth Models ───────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str


class ProjectCreateRequest(BaseModel):
    user_id: str
    title: str
    description: str = ""
    use_case: str = ""


class ProjectUpdateRequest(BaseModel):
    project_id: str
    step: int | None = None
    config: dict | None = None


class AnalyzeRequest(BaseModel):
    project_id: str
    date_col: str | None = None
    target_col: str | None = None


class TrainRequest(BaseModel):
    project_id: str
    date_col: str
    target_col: str
    drivers: list[str] = []
    horizon: int = 8
    driver_outlier_strategy: str = "keep"
    baseline_model: str = "lagged_ridge"
    multivariate_model: str = "gbm"
    lag_config: str = "1,2,4"
    auto_select_lags: bool = False
    test_window_weeks: int = 48
    validation_mode: str = "walk_forward"
    calendar_features: bool = False
    holiday_features: bool = False


class ProcessRequest(BaseModel):
    project_id: str
    date_col: str
    target_col: str
    frequency: str = "W"
    driver_date_col: str | None = None
    outlier_strategy: str = "cap"
    driver_outlier_strategy: str = "keep"


class ChatRequest(BaseModel):
    project_id: str
    message: str
    page_context: str = ""
    history: list[dict] = []
    report_data: str | None = None


# ─── Upload ────────────────────────────────────────────────────────────────────

_ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt"}


def _validate_upload(filename: str | None) -> str:
    """Return the lowered extension or raise 400 if unsupported."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )
    return ext


def _validate_dataframe(df: pd.DataFrame, label: str = "file") -> None:
    """Sanity-check a parsed DataFrame — reject garbage."""
    if df.empty:
        raise HTTPException(status_code=400, detail=f"The {label} appears to be empty after parsing.")
    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"The {label} only has {len(df.columns)} column(s). Need at least 2 (e.g. a date and a value).",
        )
    if len(df) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"The {label} only has {len(df)} row(s) of data. Need at least 3 to be useful.",
        )
    # Check that most cells aren't null (a sign of bad parsing)
    fill_rate = df.notna().mean().mean()
    if fill_rate < 0.3:
        raise HTTPException(
            status_code=400,
            detail=f"The {label} is mostly empty ({fill_rate:.0%} of cells are filled). It may not be a valid tabular file.",
        )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: str | None = Form(None),
):
    """Receive a CSV/Excel/TXT file and create a project."""
    _validate_upload(file.filename)
    pid = project_id or str(uuid.uuid4())

    # Save file temporarily
    suffix = os.path.splitext(file.filename or ".csv")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    tmp.write(content)
    tmp.close()

    try:
        df = load_dataframe(tmp.name)
    except Exception as e:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    _validate_dataframe(df, "uploaded file")

    # Detect date column
    date_col = detect_date_column(df)
    numeric_cols = detect_numeric_columns(df)

    # Store in memory
    _projects[pid] = {
        "file_path": tmp.name,
        "file_name": file.filename,
        "status": "uploaded",
        "current_step": 1,
    }
    _dataframes[pid] = df

    preview = get_preview(df, n=10)

    return {
        "project_id": pid,
        "file_name": file.filename,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "detected_date_col": date_col,
        "numeric_columns": numeric_cols,
        "preview": preview["rows"],
        "dtypes": preview["dtypes"],
    }


# ─── Upload Drivers ────────────────────────────────────────────────────────────


@router.post("/upload-drivers")
async def upload_driver_file(
    file: UploadFile = File(...),
    project_id: str | None = Form(None),
):
    """Receive an optional CSV/Excel/TXT file containing driver / exogenous data."""
    _validate_upload(file.filename)
    pid = project_id or str(uuid.uuid4())

    suffix = os.path.splitext(file.filename or ".csv")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    tmp.write(content)
    tmp.close()

    try:
        df = load_dataframe(tmp.name)
    except Exception as e:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail=f"Failed to parse driver file: {e}")

    _validate_dataframe(df, "driver file")

    date_col = detect_date_column(df)
    numeric_cols = detect_numeric_columns(df)

    _driver_dataframes[pid] = df
    _driver_file_names[pid] = file.filename or "driver_file"
    if pid in _projects:
        _projects[pid]["driver_file_name"] = file.filename

    preview = get_preview(df, n=10)

    return {
        "project_id": pid,
        "file_name": file.filename,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "detected_date_col": date_col,
        "numeric_columns": numeric_cols,
        "preview": preview["rows"],
        "dtypes": preview["dtypes"],
    }


# ─── Analyze ───────────────────────────────────────────────────────────────────


@router.post("/analyze")
async def analyze_data(req: AnalyzeRequest):
    """Analyze the uploaded dataset for data health and frequency."""
    if req.project_id not in _dataframes:
        raise HTTPException(status_code=404, detail="Project not found")

    df = _dataframes[req.project_id]
    health = get_data_health(df)

    result = {"project_id": req.project_id, "health": health}

    # If a date column is specified, validate frequency
    date_col = req.date_col or detect_date_column(df)
    if date_col and date_col in df.columns:
        freq_info = validate_frequency(df, date_col)
        result["frequency"] = freq_info
        result["date_col"] = date_col

    return result


# ─── Train ─────────────────────────────────────────────────────────────────────


def _coerce_numeric_series(values: pd.Series) -> pd.Series:
    cleaned = (
        values.astype("string")
        .str.replace(r"[£$€,_%\s]", "", regex=True)
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "null": pd.NA, "N/A": pd.NA})
    )
    return pd.to_numeric(cleaned, errors="coerce")


def _normalize_frequency(freq: str | None) -> str:
    if not freq:
        return "W-SUN"
    mapping = {
        "D": "D",
        "W": "W-SUN",
        "MS": "MS",
        "QS": "QS",
        "YS": "YS",
    }
    return mapping.get(freq.upper(), "W-SUN")


def _normalized_name(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in value.lower())
    return "_".join(part for part in cleaned.split("_") if part)


@router.post("/process")
async def process_data(req: ProcessRequest):
    """Apply Step 2 preprocessing and cache the cleaned dataframe for training."""
    if req.project_id not in _dataframes:
        raise HTTPException(status_code=404, detail="Project not found")
    _processed_driver_dataframes.pop(req.project_id, None)

    normalized_outlier = {
        "clip": "cap",
        "none": "keep",
    }.get(req.outlier_strategy, req.outlier_strategy)
    if normalized_outlier not in {"keep", "remove", "cap"}:
        raise HTTPException(
            status_code=400,
            detail="outlier_strategy must be one of: keep, remove, cap",
        )

    normalized_driver_outlier = {
        "clip": "cap",
        "none": "keep",
    }.get(req.driver_outlier_strategy, req.driver_outlier_strategy)
    if normalized_driver_outlier not in {"keep", "remove", "cap"}:
        raise HTTPException(
            status_code=400,
            detail="driver_outlier_strategy must be one of: keep, remove, cap",
        )

    raw_df = _dataframes[req.project_id].copy()

    candidate_driver_cols = [
        col
        for col in raw_df.columns
        if col not in {req.date_col, req.target_col}
    ]

    requested_date_col = req.date_col
    process_note: str | None = None
    resample_freq = _normalize_frequency(req.frequency)
    try:
        cleaned_df, prep_report = clean_dataframe_for_training(
            raw_df,
            date_col=requested_date_col,
            target_col=req.target_col,
            driver_cols=candidate_driver_cols,
            outlier_action=normalized_outlier,
            driver_outlier_action=normalized_driver_outlier,
            min_rows=20,
        )
    except ValueError as e:
        fallback_date_col = detect_date_column(raw_df)
        if (
            "No rows left after parsing" in str(e)
            and fallback_date_col
            and fallback_date_col != requested_date_col
        ):
            process_note = (
                f"Selected date column '{requested_date_col}' was not parseable. "
                f"Used '{fallback_date_col}' instead."
            )
            try:
                cleaned_df, prep_report = clean_dataframe_for_training(
                    raw_df,
                    date_col=fallback_date_col,
                    target_col=req.target_col,
                    driver_cols=candidate_driver_cols,
                    outlier_action=normalized_outlier,
                    driver_outlier_action=normalized_driver_outlier,
                    min_rows=20,
                )
            except ValueError as inner_e:
                raise HTTPException(status_code=400, detail=f"Preprocessing error: {inner_e}")
        else:
            raise HTTPException(status_code=400, detail=f"Preprocessing error: {e}")

    if not prep_report["ready"]["ready"]:
        raise HTTPException(
            status_code=400,
            detail=f"Data not ready after processing: {prep_report['ready']['errors']}",
        )

    date_col = prep_report["date_col"]
    target_col = prep_report["target_col"]

    target_only = cleaned_df[[date_col, target_col]].copy()
    target_only = target_only.set_index(date_col).sort_index()
    target_only[target_col] = pd.to_numeric(target_only[target_col], errors="coerce")
    target_only = target_only.resample(resample_freq).mean(numeric_only=True)
    target_only = target_only.dropna(subset=[target_col]).reset_index()

    if target_only.empty:
        raise HTTPException(
            status_code=400,
            detail=f"Preprocessing error: no target rows remain after resampling to '{resample_freq}'.",
        )

    _processed_dataframes[req.project_id] = target_only

    driver_file_name = _driver_file_names.get(req.project_id)
    driver_numeric_cols: list[str] = []
    if req.project_id in _driver_dataframes:
        raw_driver_df = _driver_dataframes[req.project_id].copy()
        driver_file_name = driver_file_name or _projects.get(req.project_id, {}).get("driver_file_name")

        requested_driver_date_col = req.driver_date_col or detect_date_column(raw_driver_df)
        if requested_driver_date_col and requested_driver_date_col in raw_driver_df.columns:
            driver_df = raw_driver_df.copy()
            driver_df[requested_driver_date_col] = parse_datetime_series(driver_df[requested_driver_date_col])
            driver_df = driver_df.dropna(subset=[requested_driver_date_col]).sort_values(requested_driver_date_col)
            driver_df = driver_df.drop_duplicates(subset=[requested_driver_date_col], keep="last")

            candidate_numeric = [
                c for c in detect_numeric_columns(driver_df)
                if c != requested_driver_date_col
            ]
            for col in candidate_numeric:
                driver_df[col] = _coerce_numeric_series(driver_df[col])
            driver_numeric_cols = [c for c in candidate_numeric if driver_df[c].notna().any()]

            if driver_numeric_cols:
                driver_clean = driver_df[[requested_driver_date_col, *driver_numeric_cols]].copy()
                driver_clean = driver_clean.set_index(requested_driver_date_col).sort_index()
                driver_clean = driver_clean.resample(resample_freq).mean(numeric_only=True)
                driver_clean = driver_clean.dropna(how="all")
                driver_clean = driver_clean.reset_index().rename(
                    columns={requested_driver_date_col: date_col}
                )

                # If a single generic "value" column came from a temp file,
                # expose it with a stable semantic name expected by Step 3.
                if len(driver_numeric_cols) == 1:
                    only_col = driver_numeric_cols[0]
                    name_key = _normalized_name(only_col)
                    file_key = _normalized_name(driver_file_name or "")
                    if name_key in {"value", "val"} and any(
                        token in file_key for token in {"temp", "meantemp", "temperature"}
                    ):
                        driver_clean = driver_clean.rename(columns={only_col: "temp_mean"})
                        driver_numeric_cols = ["temp_mean"]

                _processed_driver_dataframes[req.project_id] = driver_clean

    numeric_cols = detect_numeric_columns(target_only)
    preview = get_preview(target_only, n=10)

    return {
        "project_id": req.project_id,
        "rows": len(target_only),
        "columns": target_only.columns.tolist(),
        "numeric_columns": numeric_cols,
        "detected_date_col": date_col,
        "target_col": target_col,
        "preview": preview["rows"],
        "dtypes": preview["dtypes"],
        "report": prep_report,
        "note": process_note,
        "driver": {
            "file_name": driver_file_name,
            "numeric_columns": driver_numeric_cols,
        },
    }


@router.get("/analysis/sample")
async def get_analysis_sample():
    """
    Load a precomputed analysis bundle (json + csv artifacts) for Step 4.
    This lets the frontend render analysis views without retraining.
    """
    manifest_path = _analysis_dir / "analysis_result.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="analysis_result.json not found")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    outputs = manifest.get("outputs", {})

    forecast_path = _resolve_analysis_path_multi(outputs.get("forecast_csv", ""), ["forecast.csv", "forecasts/forecast.csv"])
    test_pred_path = _resolve_analysis_path(outputs.get("test_predictions_csv", ""), "artifacts/test_predictions.csv")
    feature_importance_path = _resolve_analysis_path(
        outputs.get("feature_importance_csv", ""),
        "artifacts/feature_importance.csv",
    )
    feature_frame_path = _resolve_analysis_path(outputs.get("feature_frame_csv", ""), "artifacts/feature_frame.csv")
    target_series_path = _resolve_analysis_path(outputs.get("target_series_csv", ""), "artifacts/target_series.csv")
    temp_weekly_path = _resolve_analysis_path(outputs.get("temp_weekly_csv", ""), "artifacts/temp_weekly.csv")
    holiday_weekly_path = _resolve_analysis_path(outputs.get("holiday_weekly_csv", ""), "artifacts/holiday_weekly.csv")
    plot_path = _resolve_analysis_path(outputs.get("plot", ""), "plots/model_fit.png")

    return {
        "manifest": manifest,
        "available": {
            "plot": plot_path.exists(),
            "forecast": forecast_path.exists(),
            "test_predictions": test_pred_path.exists(),
            "feature_importance": feature_importance_path.exists(),
            "feature_frame": feature_frame_path.exists(),
            "target_series": target_series_path.exists(),
            "temp_weekly": temp_weekly_path.exists(),
            "holiday_weekly": holiday_weekly_path.exists(),
        },
        "datasets": {
            "forecast": _csv_records(forecast_path),
            "test_predictions": _csv_records(test_pred_path),
            "feature_importance": _csv_records(feature_importance_path),
            "feature_frame": _csv_records(feature_frame_path),
            "target_series": _csv_records(target_series_path),
            "temp_weekly": _csv_records(temp_weekly_path),
            "holiday_weekly": _csv_records(holiday_weekly_path),
        },
    }


@router.post("/train")
async def train_model(req: TrainRequest):
    """Run baseline + multivariate forecasting models."""
    if req.project_id not in _dataframes and req.project_id not in _processed_dataframes:
        raise HTTPException(status_code=404, detail="Project not found")

    normalized_driver_outlier = {
        "clip": "cap",
        "none": "keep",
    }.get(req.driver_outlier_strategy, req.driver_outlier_strategy)
    if normalized_driver_outlier not in {"keep", "remove", "cap"}:
        raise HTTPException(
            status_code=400,
            detail="driver_outlier_strategy must be one of: keep, remove, cap",
        )

    if req.project_id in _processed_dataframes:
        df = _processed_dataframes[req.project_id].copy()
        date_col = _resolve_df_column(df, req.date_col, "date")
        target_col = _resolve_df_column(df, req.target_col, "target")
    else:
        raw_df = _dataframes[req.project_id].copy()
        try:
            df, prep_report = clean_dataframe_for_training(
                raw_df,
                date_col=req.date_col,
                target_col=req.target_col,
                driver_cols=req.drivers if req.drivers else None,
                driver_outlier_action=normalized_driver_outlier,
                min_rows=20,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Preprocessing error: {e}")

        if not prep_report["ready"]["ready"]:
            raise HTTPException(
                status_code=400,
                detail=f"Data not ready for training: {prep_report['ready']['errors']}",
            )

        date_col = prep_report["date_col"]
        target_col = prep_report["target_col"]

    selected_drivers = req.drivers
    if selected_drivers and req.project_id in _processed_driver_dataframes:
        driver_df = _processed_driver_dataframes[req.project_id].copy()
        resolved_driver_cols = []
        for requested in selected_drivers:
            resolved = _resolve_optional_df_column(driver_df, requested)
            if resolved:
                resolved_driver_cols.append(resolved)
        # Deduplicate while preserving order.
        available_driver_cols = list(dict.fromkeys(resolved_driver_cols))

        driver_date_col = _resolve_optional_df_column(driver_df, date_col)
        if available_driver_cols and driver_date_col:
            df = df.merge(
                driver_df[[driver_date_col, *available_driver_cols]],
                left_on=date_col,
                right_on=driver_date_col,
                how="left",
            )
            if driver_date_col != date_col and driver_date_col in df.columns:
                df = df.drop(columns=[driver_date_col])
            selected_drivers = available_driver_cols
        else:
            selected_drivers = []

    date_col = _resolve_df_column(df, date_col, "date")
    target_col = _resolve_df_column(df, target_col, "target")

    try:
        results = train_and_forecast(
            df=df,
            project_id=req.project_id,
            date_col=date_col,
            target_col=target_col,
            drivers=selected_drivers,
            horizon=req.horizon,
            baseline_model=req.baseline_model,
            multivariate_model=req.multivariate_model,
            lag_config=req.lag_config,
            auto_select_lags=req.auto_select_lags,
            test_window_weeks=req.test_window_weeks,
            validation_mode=req.validation_mode,
            calendar_features=req.calendar_features,
            holiday_features=req.holiday_features,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {e}")

    return results


# ─── Chat ──────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Context-aware chat endpoint powered by Gemini 1.5 Flash.
    Falls back to keyword matching when GEMINI_API_KEY is not set.
    """
    return await generate_chat_response(
        message=req.message,
        page_context=req.page_context,
        report_data=req.report_data,
        history=req.history,
    )


# ─── Auth ──────────────────────────────────────────────────────────────────────


@router.post("/auth/register")
async def register(req: AuthRequest):
    """Register a new user with username + password."""
    if not req.username or not req.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if req.username in _users:
        raise HTTPException(status_code=409, detail="Username already exists")

    user_id = str(uuid.uuid4())
    _users[req.username] = {
        "user_id": user_id,
        "password_hash": _hash_pw(req.password),
    }
    _user_projects[user_id] = []

    return {"user_id": user_id, "username": req.username}


@router.post("/auth/login")
async def login(req: AuthRequest):
    """Login with username + password."""
    user = _users.get(req.username)
    if not user or user["password_hash"] != _hash_pw(req.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {"user_id": user["user_id"], "username": req.username}


# ─── Project CRUD ──────────────────────────────────────────────────────────────


@router.post("/projects/create")
async def create_project(req: ProjectCreateRequest):
    """Create a new project for a user."""
    project_id = str(uuid.uuid4())
    now = _now_iso()
    project = {
        "project_id": project_id,
        "user_id": req.user_id,
        "title": req.title,
        "description": req.description,
        "use_case": req.use_case,
        "current_step": 1,
        "completed_steps": [],
        "config": {},
        "files": [],
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    _projects[project_id] = project

    if req.user_id in _user_projects:
        _user_projects[req.user_id].append(project_id)
    else:
        _user_projects[req.user_id] = [project_id]

    return project


@router.get("/projects/{user_id}")
async def list_projects(user_id: str):
    """List all projects for a user."""
    project_ids = _user_projects.get(user_id, [])
    projects = [_projects[pid] for pid in project_ids if pid in _projects]
    return {"projects": projects}


@router.get("/projects/detail/{project_id}")
async def get_project(project_id: str):
    """Get a single project's details."""
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/stories")
async def list_stories(search: str | None = None, category: str | None = None):
    """List published stories for Explore feed."""
    term = (search or "").strip().lower()
    wanted_category = (category or "").strip().lower()

    stories: list[dict[str, Any]] = []
    for project in _projects.values():
        if project.get("status") != "published":
            continue
        card = _story_card(project)

        if term:
            haystack = " ".join(
                [
                    str(card.get("title", "")),
                    str(card.get("description", "")),
                    str(card.get("author", "")),
                    " ".join(card.get("categories", [])),
                ]
            ).lower()
            if term not in haystack:
                continue

        if wanted_category:
            categories = [c.lower() for c in card.get("categories", [])]
            if wanted_category not in categories:
                continue

        stories.append(card)

    stories.sort(key=lambda s: s.get("published_at") or "", reverse=True)
    return {"stories": stories, "total": len(stories)}


@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    """Get full story payload for detail page."""
    project = _projects.get(story_id)
    if not project or project.get("status") != "published":
        raise HTTPException(status_code=404, detail="Story not found")

    config = project.get("config") if isinstance(project.get("config"), dict) else {}
    return {
        **_story_card(project),
        "notebook_blocks": config.get("notebook_blocks", []),
        "publish_mode": config.get("publish_mode", "live"),
    }


@router.post("/projects/update")
async def update_project(req: ProjectUpdateRequest):
    """Update project step or config."""
    project = _projects.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if req.step is not None:
        project["current_step"] = req.step
        if req.step - 1 not in project.get("completed_steps", []):
            project.setdefault("completed_steps", []).append(req.step - 1)

    if req.config is not None:
        project.setdefault("config", {}).update(req.config)
        if not project.get("user_id"):
            author_user_id = req.config.get("author_user_id")
            if isinstance(author_user_id, str) and author_user_id.strip():
                project["user_id"] = author_user_id.strip()
        if bool(req.config.get("published")):
            project["status"] = "published"
            project["published_at"] = project.get("published_at") or _now_iso()
        elif req.config.get("published") is False:
            project["status"] = "draft"
            project["published_at"] = None

    project["updated_at"] = _now_iso()

    return project
