# Infosys Wealth Management — Portfolio Drift Dashboard

A full-stack wealth-management console for advisors and admins to monitor client portfolio drift, prioritize outreach with a weighted scoring model, and generate AI-assisted advisory reports.

Built as part of the **Infosys Internship** project.

---

## Overview

Advisors need a clear view of which clients are drifting outside their target allocations, how severe that drift is, and what to do next. This application:

1. Loads mock client portfolio data from Excel / JSON
2. Scores each client on five weighted risk components
3. Classifies them as **Normal**, **Watch**, **Review Soon**, or **Critical**
4. Surfaces book-level analytics and per-client deep dives
5. Generates Gemini-powered advisory summaries (brief or detailed)
6. Lets advisors export a client summary to PDF

---

## Features

### Authentication
- Demo JWT login with role-based access
- **Admin** and **Advisor** roles
- Session stored in the browser (`sessionStorage`)

### Advisor Dashboard
- KPI strip (total clients + count by alert status)
- Analytics charts (Recharts) across the book of business
- Filter by alert status and sort by priority / drift / name
- **Card view** or **List view** toggle for client portfolios
- Click any client to open their advisory report

### Client Advisory Report
- Hero metrics: status, priority score, drift, portfolio value, risk level
- **Asset allocation vs target** bars with gray ideal markers and over/under tags
- Priority score component breakdown (weighted bars)
- AI advisory report with:
  - **Brief summary** (default): Executive Summary + Recommended Actions
  - **Detailed summary**: Situation Assessment + Key Concerns as well
- Placeholder actions: Schedule portfolio review / Compare with previous review
- **Export summary** — downloads a multi-page PDF of the report (light theme, chrome buttons excluded)
- Dark / light theme toggle (persisted)

### Admin Console
- Configure global scoring component weights
- Live impact preview on classification counts
- Link into the advisor dashboard

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, React Router, Recharts |
| PDF export | html2canvas + jsPDF |
| Backend | Python FastAPI, Uvicorn |
| Auth | JWT (`python-jose`) |
| Data | pandas / openpyxl (Excel ingest), JSON profile store |
| AI reports | Google Gemini (`google-generativeai`) |
| Config | `python-dotenv` |

---

## Project Structure

```
├── api/
│   ├── auth.py          # Demo users + JWT helpers
│   ├── llm.py           # Gemini report generation + file cache
│   ├── scoring.py       # Weights load/save + priority scoring
│   └── server.py        # FastAPI routes
├── data/
│   ├── profiles.json    # Computed client profiles
│   ├── weights.json     # Global component weights
│   └── reports/         # Cached AI reports (gitignored JSON)
├── src/
│   ├── api/client.ts    # Frontend API client
│   ├── components/      # Profile details, allocation bars, score bars
│   ├── context/         # Auth + theme providers
│   ├── pages/           # Login, Advisor, Admin, Client report
│   └── utils/           # PDF export helper
├── backend.py           # Offline Excel → profiles.json pipeline
├── Mock-Up Data - new.xlsx
├── requirements.txt
├── package.json
└── vite.config.ts       # Dev server on :4173, proxies /api → :8000
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- A **Google Gemini API key** (optional for login/dashboards; required for AI reports)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/AkshatGoyal24/Infosys_Internship.git
cd Infosys_Internship
```

### 2. Python backend

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements-etl.txt
```

For API-only (no Excel ETL):

```bash
pip install -r requirements.txt
```

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
JWT_SECRET=change-me-in-production
```

### 4. Frontend packages

```bash
npm install
```

### 5. (Optional) Rebuild profiles from Excel

If you change the workbook:

```bash
python backend.py
```

This writes updated rows to `data/profiles.json`.

---

## Running Locally

Use **two terminals**.

### API (port 8000)

```bash
python -m uvicorn api.server:app --reload --port 8000
```

### Frontend (port 4173)

```bash
npm run dev
```

Open **http://localhost:4173/**

Vite proxies `/api/*` to `http://localhost:8000`.

---

## Deploying on Vercel

This repo deploys as one Vercel project with **two services** (see `vercel.json`):

- **web** — Vite/React SPA
- **backend** — FastAPI (`api.server:app`), served under `/api/*`

### Steps

1. Push to `main` (already connected to your Vercel project).
2. In Vercel → Project → **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` (required for AI reports)
   - `GEMINI_MODEL` (optional)
   - `JWT_SECRET` (recommended for a public demo)
3. Redeploy (Deployments → Redeploy, or push another commit).
4. Open the `*.vercel.app` URL and log in with a demo account.

### Vercel notes

- `node_modules` must **not** be in git (causes `tsc: Permission denied` on Linux builders).
- Python is pinned to **3.12** via `.python-version`.
- On Vercel, weight saves and AI report caches write to `/tmp` and may reset between cold starts (fine for demos).
- Same-origin `/api` calls — no separate API URL needed.

---

## Demo Accounts

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Admin (weights + advisor view) |
| `advisor1` | `advisor123` | Advisor |
| `advisor2` | `advisor123` | Advisor |

These credentials are for local demo use only.

---

## Priority Scoring Model

Each client gets five normalized component scores (0–1):

| Component | Meaning |
| --- | --- |
| Drift Severity | Absolute portfolio drift vs critical threshold |
| Persistence | Days outside threshold (capped) |
| Velocity | Drift speed over ~30 days |
| Money Impact | Dollar drift magnitude (banded) |
| Concentration | Concentration risk (banded) |

**Priority score** = weighted sum of components × 100 (reported to 1 decimal).

| Score | Classification |
| --- | --- |
| &lt; 40 | Normal |
| 40–59 | Watch |
| 60–79 | Review Soon |
| ≥ 80 | Critical |

Admins can change the global weights; all profiles reclassify from the same component scores.

---

## API Endpoints (summary)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Login → JWT |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/profiles` | All scored profiles |
| `GET` | `/api/profiles/{id}` | One profile |
| `GET` | `/api/profiles/{id}/report` | AI report (cached if available) |
| `POST` | `/api/profiles/{id}/report` | Force regenerate AI report |
| `GET` | `/api/weights` | Current weights |
| `PUT` | `/api/weights` | Update weights (admin) |

All profile/report/weights routes require a Bearer token.

---

## AI Reports

- Generated via Gemini; responses are validated as structured JSON
- Cached under `data/reports/` (keyed by client + prompt/model fingerprint)
- UI defaults to **brief** view; advisors can switch to **detailed**
- Without `GEMINI_API_KEY`, report generation will fail (dashboards still work)

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `python backend.py` | Recompute `data/profiles.json` from Excel |
| `python -m uvicorn api.server:app --reload --port 8000` | Start API |

---

## Notes

- Do not commit `.env` (already gitignored)
- Cached report JSON under `data/reports/` is gitignored
- Theme preference is stored in `localStorage` as `portfolio_theme`
- Auth token is stored in `sessionStorage` as `portfolio_drift_token`

---

## License

Internship / educational use for Infosys project work.
