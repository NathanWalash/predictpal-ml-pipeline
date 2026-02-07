"""
endpoints.py — All FastAPI routes.
Upload, Analyze, Train, Chat, Auth, Projects.
"""

import os
import uuid
import hashlib
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
from pydantic import BaseModel

from app.core.processing import (
    detect_date_column,
    detect_numeric_columns,
    validate_frequency,
    get_data_health,
    load_dataframe,
    get_preview,
)
from app.core.training import train_and_forecast
from app.core.forecasting import run_forecast
from app.core.preprocessing import clean_dataframe_for_training

router = APIRouter()

# In-memory stores for demo
_projects: dict = {}
_dataframes: dict = {}
_driver_dataframes: dict = {}  # project_id -> driver DataFrame
_users: dict = {}  # username -> {password_hash, user_id}
_user_projects: dict = {}  # user_id -> [project_ids]


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


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
    baseline_model: str = "lagged_ridge"
    multivariate_model: str = "gbm"
    lag_config: str = "1,2,4"
    auto_select_lags: bool = False
    test_window_weeks: int = 48
    validation_mode: str = "walk_forward"
    calendar_features: bool = False
    holiday_features: bool = False


class ChatRequest(BaseModel):
    project_id: str
    message: str


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
async def upload_file(file: UploadFile = File(...)):
    """Receive a CSV/Excel/TXT file and create a project."""
    _validate_upload(file.filename)
    project_id = str(uuid.uuid4())

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
    _projects[project_id] = {
        "file_path": tmp.name,
        "file_name": file.filename,
        "status": "uploaded",
        "current_step": 1,
    }
    _dataframes[project_id] = df

    preview = get_preview(df, n=10)

    return {
        "project_id": project_id,
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
    project_id: str | None = None,
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


@router.post("/train")
async def train_model(req: TrainRequest):
    """Run baseline + multivariate forecasting models."""
    if req.project_id not in _dataframes:
        raise HTTPException(status_code=404, detail="Project not found")

    raw_df = _dataframes[req.project_id].copy()
    try:
        df, prep_report = clean_dataframe_for_training(
            raw_df,
            date_col=req.date_col,
            target_col=req.target_col,
            driver_cols=None,
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

    # Prepare time series
    df = df.sort_values(date_col).reset_index(drop=True)
    df = df.set_index(date_col)

    # Infer frequency
    freq = pd.infer_freq(df.index)
    if freq is None:
        freq = "W"
    df = df.asfreq(freq)
    df[target_col] = df[target_col].interpolate(method="linear").ffill().bfill()

    series = df[target_col].dropna().astype(float)

    if len(series) < 20:
        raise HTTPException(
            status_code=400,
            detail="Need at least 20 data points to train a model",
        )

    try:
        results = train_and_forecast(
            df=df,
            project_id=req.project_id,
            date_col=req.date_col,
            target_col=req.target_col,
            drivers=req.drivers,
            horizon=req.horizon,
            baseline_model=req.baseline_model,
            multivariate_model=req.multivariate_model,
            lag_config=req.lag_config,
            auto_select_lags=req.auto_select_lags,
            test_window_weeks=req.test_window_weeks,
            validation_mode=req.validation_mode,
            calendar_features=req.calendar_features,
            holiday_features=req.holiday_features,
            input_paths=[Path(_projects[req.project_id]["file_path"])],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {e}")

    return results


# ─── Chat ──────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Simple chat endpoint. Returns contextual responses.
    In production, wire this to an LLM with project context.
    """
    project = _projects.get(req.project_id)

    # Demo contextual responses
    msg = req.message.lower()

    if any(w in msg for w in ["hello", "hi", "hey"]):
        reply = "Hey! I'm your Forecast Buddy. Upload a dataset and I'll help you explore patterns and build forecasts. What data are you working with?"
    elif "upload" in msg or "file" in msg:
        reply = "You can drag and drop a CSV or Excel file in Step 1. I'll automatically detect date columns and numeric targets for you."
    elif "driver" in msg or "feature" in msg:
        reply = "Drivers are external factors that might influence your data — like seasonality, holidays, or temperature. Toggle them on in Step 3 to see if they improve the forecast!"
    elif "accuracy" in msg or "improve" in msg:
        reply = "The multivariate model adds external drivers on top of the baseline. If a driver like 'holidays' captures real variation, you'll see the green line track reality better than the blue dashed baseline."
    elif "forecast" in msg or "predict" in msg:
        reply = "Once you've selected your columns and drivers, hit 'Run Forecast'. I'll train two models — a simple baseline and a gradient-boosted one with your chosen drivers."
    else:
        reply = f"Interesting question! I'm a demo buddy right now, so my answers are limited. In the full version, I'd use an LLM to give you deep insights about your data and forecasts."

    return {
        "role": "assistant",
        "content": reply,
    }


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

    return project
