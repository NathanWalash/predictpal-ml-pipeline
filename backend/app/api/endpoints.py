"""
endpoints.py — All FastAPI routes.
Upload, Analyze, Train, Chat, Auth, Projects.
"""

import os
import uuid
import hashlib
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import pandas as pd

from app.core.processing import (
    detect_date_column,
    detect_numeric_columns,
    validate_frequency,
    get_data_health,
    load_dataframe,
)
from app.core.forecasting import run_forecast

router = APIRouter()

# In-memory stores for demo
_projects: dict = {}
_dataframes: dict = {}
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
    horizon: int = 12


class ChatRequest(BaseModel):
    project_id: str
    message: str


# ─── Upload ────────────────────────────────────────────────────────────────────


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Receive a CSV/Excel file and create a project."""
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

    return {
        "project_id": project_id,
        "file_name": file.filename,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "detected_date_col": date_col,
        "numeric_columns": numeric_cols,
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

    df = _dataframes[req.project_id].copy()

    if req.date_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Date column '{req.date_col}' not found")
    if req.target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{req.target_col}' not found")

    # Prepare time series
    df[req.date_col] = pd.to_datetime(df[req.date_col])
    df = df.sort_values(req.date_col).reset_index(drop=True)
    df = df.set_index(req.date_col)

    # Infer frequency
    freq = pd.infer_freq(df.index)
    if freq is None:
        freq = "W"
    df = df.asfreq(freq)

    series = df[req.target_col].dropna().astype(float)

    if len(series) < 20:
        raise HTTPException(
            status_code=400,
            detail="Need at least 20 data points to train a model",
        )

    try:
        results = run_forecast(
            series=series,
            horizon=req.horizon,
            drivers=req.drivers if req.drivers else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {e}")

    # Attach historical data for charting
    results["historical"] = {
        "values": series.tolist(),
        "index": series.index.strftime("%Y-%m-%d").tolist(),
    }

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
