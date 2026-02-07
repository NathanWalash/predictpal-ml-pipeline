# PredictPal - Copilot Instructions

## Snapshot

PredictPal is a monorepo with:
- `backend/`: FastAPI API (Python 3.10-3.12)
- `frontend/`: Next.js 16 App Router app (React 19 + TypeScript)

Frontend talks to backend through `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api`).

## Current Architecture

### Backend
- Entry point: `backend/app/main.py`
- Router: `backend/app/api/endpoints.py` mounted at `/api`
- CORS allows `http://localhost:3000`
- Runtime state is in-memory dicts (`_projects`, `_users`, `_dataframes`, etc.) and resets on backend restart
- Forecast/training pipeline is in `backend/app/core/training.py` and related modules (`features.py`, `evaluation.py`, `grid_search.py`, `models.py`)
- Preprocessing pipeline is in `backend/app/core/preprocessing.py`
- Data loading and detection logic is in `backend/app/core/processing.py`

### Frontend
- App Router pages are under `frontend/src/app/`
- Main build wizard route is `/create` (not `/build`)
- Wizard step components are in `frontend/src/components/steps/`:
  - `Step1GetStarted.tsx`
  - `Step2ProcessData.tsx`
  - `Step3TrainForecast.tsx`
  - `Step4Analysis.tsx`
  - `Step5Showcase.tsx`
- Shared state uses Zustand in `frontend/src/lib/store.ts`:
  - `useAuthStore` is persisted to localStorage
  - `useBuildStore` is in-memory per tab session
- API wrappers are in `frontend/src/lib/api.ts`

## API Surface (Current)

Primary backend routes used by frontend:
- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Projects:
  - `POST /api/projects/create`
  - `GET /api/projects/{user_id}`
  - `GET /api/projects/detail/{project_id}`
  - `POST /api/projects/update`
- Data pipeline:
  - `POST /api/upload`
  - `POST /api/upload-drivers`
  - `POST /api/analyze`
  - `POST /api/process`
  - `POST /api/train`
  - `GET /api/analysis/sample`
- Chat:
  - `POST /api/chat`
- Explore/stories:
  - `GET /api/stories`
  - `GET /api/stories/{story_id}`

## Data and Forecast Flow

1. Step 1 uploads target file via `/upload`, optional driver file via `/upload-drivers`.
2. Step 2 calls `/process` to clean/normalize target data and optional drivers.
3. Step 3 calls `/train` for baseline + multivariate forecasting.
4. Step 4 currently renders from `/analysis/sample` (precomputed bundle from `backend/app/outputs`), not from per-project training output.
5. Step 5 builds a notebook-style story and publishes by calling `/projects/update` with `config.published = true`.

## Chat Behavior

- Backend chat is implemented in `backend/app/core/gemini.py`.
- If `GEMINI_API_KEY` is set, `/chat` uses Google Gemini (`google-genai`) with retry/error handling.
- If no key exists, it falls back to keyword-based stub replies.
- Frontend chat context is assembled from current wizard state in `frontend/src/components/ChatSidebar.tsx`.

## Story/Explore Behavior

- Live stories come from backend published projects (`/stories`).
- Explore page also merges static debug stories from `frontend/src/lib/debugStories.ts`.
- Story detail page loads either backend story or debug story, then renders notebook blocks via `frontend/src/components/story/StoryNotebook.tsx`.

## UI and Styling Conventions

- Reusable UI primitives are in `frontend/src/components/ui/index.tsx`.
- `BubbleSelect` is the default selector pattern in the wizard.
- Theme is dark slate/teal across pages.
- Icons use `lucide-react`.
- Utility for class merging is `cn()` from `frontend/src/lib/utils.ts`.

## Important Gotchas

- Backend storage is volatile in-memory; restarting server drops users/projects/uploads.
- Step 4 and story charts rely on sample analysis artifacts, so they can be decoupled from the exact project just trained.
- Some Step components still destructure the full Zustand store; prefer selector-based access in new performance-sensitive components.
- `.env` may include `OPENAI_API_KEY`, but chat path is Gemini-based in current implementation.
- `class-variance-authority` exists in dependencies but UI primitives are handwritten in `ui/index.tsx`.

## Dependency Constraints

Backend pins include:
- `pandas>=1.5,<2.2`
- `scikit-learn>=1.0,<1.4`
- `numpy>=1.24,<2.0`
- `skforecast==0.11.0`
- `google-genai>=1.0.0`

Frontend core versions:
- `next@16.1.6`
- `react@19.2.3`
- `tailwindcss@4`
- `zustand@5`

## Commands

| Task | Directory | Command |
|------|-----------|---------|
| Backend dev | `backend/` | `python -m uvicorn app.main:app --reload --port 8000` |
| Frontend dev | `frontend/` | `npm run dev` |
| Frontend build | `frontend/` | `npm run build` |
| Frontend lint | `frontend/` | `npm run lint` |
| Backend tests | `backend/` | `pytest` |
