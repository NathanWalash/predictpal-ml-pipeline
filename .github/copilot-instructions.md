# ForecastBuddy — Copilot Instructions

## Architecture

Monorepo: `backend/` (FastAPI, Python 3.10–3.12) and `frontend/` (Next.js 16, React 19, TypeScript). They communicate via REST — the frontend Axios client hits `http://localhost:8000/api`. Backend CORS allows `localhost:3000`.

**All backend state is in-memory dicts** (`_users`, `_projects`, `_dataframes`). Everything resets on server restart. Auth is SHA-256 hashed passwords with no tokens or middleware — intentionally simple for a hackathon.

## Backend Conventions

- Single router in `backend/app/api/endpoints.py`, mounted at `/api` in `main.py`
- Request bodies: Pydantic `BaseModel` subclasses defined inline in `endpoints.py`
- Routes return plain `dict`, no response models
- Run with: `python -m uvicorn app.main:app --reload --port 8000` (from `backend/`)
- Core logic split: `core/processing.py` (data ingestion) and `core/forecasting.py` (skforecast models)
- `core/config.py` exists but is **unused** — Supabase/OpenAI clients are stubbed
- Chat endpoint is a keyword-matching stub, not connected to any LLM
- **Version constraints matter**: `pandas<2.2`, `scikit-learn<1.4`, `skforecast==0.11.0`, `numpy<2.0`

## Frontend Conventions

- **App Router** — all pages use `"use client"` directive
- **State**: two Zustand stores in `src/lib/store.ts`:
  - `useAuthStore` — persisted to localStorage, holds `user: {user_id, username} | null`
  - `useBuildStore` — not persisted, ~40 flat fields with individual setters, steps 1–5
- **Selectors**: always use per-field selectors: `useBuildStore((s) => s.currentStep)`, never destructure the full store at top level
- **API client**: `src/lib/api.ts` — one async function per endpoint, returns `res.data`
- **Icons**: all from `lucide-react`, never use other icon libraries
- **Path alias**: `@/*` → `./src/*`. Always import as `@/lib/store`, `@/components/ui`, etc.

## UI Component Patterns

All primitives live in **one barrel file**: `src/components/ui/index.tsx`. Import as:
```tsx
import { Button, BubbleSelect, Input, Card } from "@/components/ui";
```

- `BubbleSelect` is the signature component — use it instead of `<Select>` for user-facing option picking. It takes `options: {id, label, icon?, description?}[]` and supports `multi` mode.
- Dark theme hardcoded everywhere: backgrounds `slate-800/900`, accents `teal-400/500/600`, cards use `rounded-2xl border border-slate-800 bg-slate-900/60 p-6`
- Use `cn()` from `@/lib/utils` for all className merging (clsx + tailwind-merge)

## Build Step Component Pattern

Each `Step{N}*.tsx` in `src/components/build/` follows this structure:
1. `"use client"` + destructure state from `useBuildStore()`
2. Local `useState` for transient UI state (`status: "idle" | "success" | "error"`)
3. Navigation at bottom: `<Button variant="secondary" onClick={prevStep}>← Back</Button>` + continue button calling `completeStep(n); nextStep()`
4. Loading state via store: `setLoading(true)` / `setLoadingMessage("...")`

## Key Gotchas

- `config.py` and `class-variance-authority` are installed but unused — don't reference them
- Forecast drivers are synthetic (`generate_dummy_exog`), not from real uploaded data
- `useBuildStore` resets on refresh — this is intentional
- React Compiler is enabled (`babel-plugin-react-compiler`) — avoid non-idiomatic mutations
- Debug mode on `/build` bypasses step gating — toggle via the bug icon

## Commands

| Task | Directory | Command |
|------|-----------|---------|
| Backend dev | `backend/` | `python -m uvicorn app.main:app --reload --port 8000` |
| Frontend dev | `frontend/` | `npm run dev` |
| Frontend build | `frontend/` | `npm run build` |
| Frontend lint | `frontend/` | `npm run lint` |
