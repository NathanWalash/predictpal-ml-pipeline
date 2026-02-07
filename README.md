# ForecastBuddy

A guided time-series forecasting workbench. Upload data, configure processing, train models, build reports, and publish — all through a friendly step-by-step UI.

**Stack:** Next.js 16 · Tailwind CSS 4 · Zustand · FastAPI · skforecast · Supabase (optional)

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 20+ | `node -v` |
| **npm** | 10+ | `npm -v` |
| **Python** | 3.10 – 3.12 | `python --version` |
| **pip** | latest | `pip --version` |

---

## Repo Structure

```
├── backend/             # FastAPI server
│   ├── app/
│   │   ├── main.py          # Entry point, CORS
│   │   ├── api/endpoints.py # All routes (upload, analyze, train, chat, auth)
│   │   └── core/            # processing.py, forecasting.py, config.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/            # Next.js app
│   ├── src/
│   │   ├── app/             # Pages: /, /build, /explore, /about, /login
│   │   ├── components/      # Header, ChatSidebar, build steps, UI kit
│   │   └── lib/             # store.ts, api.ts, utils.ts
│   └── package.json
├── supabase_schema.sql  # Optional DB schema
└── requirements.txt     # Root-level Python deps (same as backend)
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url>
cd LeedsHack2026
```

### 2. Backend setup

```bash
# Create & activate a virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
# (or from backend/ — same file)

# Create your env file
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your keys (Supabase, OpenAI) — optional for demo mode

# Start the API server
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**. Docs at **http://localhost:8000/docs**.

### 3. Frontend setup

Open a **second terminal**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Environment Variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=your-supabase-url       # optional for demo
SUPABASE_KEY=your-supabase-anon-key   # optional for demo
OPENAI_API_KEY=your-openai-key        # optional for demo
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

This file is **not** committed — create it locally. The default value above works for local dev.

---

## Key Commands

| What | Where | Command |
|------|-------|---------|
| Start backend (dev) | `backend/` | `python -m uvicorn app.main:app --reload --port 8000` |
| Start frontend (dev) | `frontend/` | `npm run dev` |
| Build frontend | `frontend/` | `npm run build` |
| Lint frontend | `frontend/` | `npm run lint` |

---

## Pages & Features

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, capabilities, how-it-works |
| `/build` | 5-step wizard: Get Started → Process Data → Train → Outputs → Showcase |
| `/explore` | Browse published community projects |
| `/about` | Mission, tech stack, credits |
| `/login` | Simple username/password auth |

- **Dark theme** throughout
- **BubbleSelect** UI — pick options with friendly pill buttons instead of dropdowns
- **Debug mode** — toggle the bug icon on `/build` to see state + skip between steps
- **Chat sidebar** — persistent AI assistant on the build page

---

## Auth (demo mode)

Auth is intentionally simple for the hackathon — passwords are SHA-256 hashed and stored in-memory. Data resets when the backend restarts. The endpoints are:

- `POST /api/auth/register` — `{ username, password }`
- `POST /api/auth/login` — `{ username, password }`

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Run `npm run build` in `frontend/` to check for errors
4. Open a PR
- Generate showcase exports in `6_Showcase.py`
