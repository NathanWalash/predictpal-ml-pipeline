# PredictPal

PredictPal is a guided time-series forecasting app for hackathon demos and rapid prototyping.
It takes users from raw data to trained forecasts, then to shareable notebook-style story posts.

## What It Does
- Upload target and optional driver datasets.
- Configure preprocessing and modeling with a guided 5-step flow.
- Train baseline + multivariate models and generate forecast artifacts.
- Review model quality and forecast outputs in Step 4 visual analysis.
- Build and publish story posts in Step 5 (including anonymous/local demo publishing).
- Browse posts in Explore with search and category filters.

## Stack
- Frontend: Next.js 16, React 19, Tailwind CSS 4, Zustand, Recharts, Lucide
- Backend: FastAPI, Pandas, scikit-learn, skforecast
- Optional integrations: Supabase and Gemini/OpenAI-style AI helpers

## Repository Layout
```text
backend/
  app/
    main.py
    api/endpoints.py
    core/
    outputs/
frontend/
  src/
    app/
      page.tsx
      create/page.tsx
      explore/page.tsx
      explore/[storyId]/page.tsx
      about/page.tsx
      login/page.tsx
      terms/page.tsx
    components/
      steps/
      story/
    lib/
      api.ts
      store.ts
      debugStories.ts
      localStories.ts
README.md
supabase_schema.sql
```

## Prerequisites
- Node.js 20+
- npm 10+
- Python 3.10 to 3.12

## Quick Start
1. Clone and open the project:
```bash
git clone <repo-url>
cd LeedsHack2026
```

2. Create Python environment and install backend dependencies:
```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r backend/requirements.txt
```

3. Create backend env file:
```bash
copy backend\.env.example backend\.env
```
Linux/macOS:
```bash
cp backend/.env.example backend/.env
```

4. Start backend:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

5. Start frontend in a second terminal:
```bash
cd frontend
npm install
npm run dev
```

## URLs
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`
- Backend docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Environment Variables
Backend (`backend/.env`):
```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-key
```

Frontend (`frontend/.env.local`, optional):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```
If `NEXT_PUBLIC_API_URL` is not set, frontend defaults to `http://localhost:8000/api`.

## Main User Flow (`/create`)
1. Get Started
2. Process Data
3. Train & Forecast
4. Analysis & Results
5. Publish Story

## Debug Mode Notes
- Use the bug button on `/create` to open Debug State.
- Debug State supports step-jump controls.
- Step 5 debug pinning now lives there:
- `Pin Step 5 publish as persistent debug sample in Explore`
- This flag controls whether published stories are also stored as pinned debug samples.

## Explore and Persistence Behavior
- Backend stories are in-memory by default.
- The app also keeps local persisted stories in browser storage for demo resilience:
- Anonymous/local published stories can still appear and open in Explore.
- Pinned debug samples can persist in the browser.
- Explore feed merges backend, local, and sample stories with dedupe.

## Common Commands
Backend:
```bash
python -m uvicorn app.main:app --reload --port 8000
python -m py_compile app/api/endpoints.py app/core/training.py
```

Frontend:
```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

## Notes for Demo Day
- If backend restarts, in-memory backend projects reset.
- Local persisted stories/debug samples in browser can still power Explore demos.
- For clean demo setup, clear browser local storage between runs if needed.
