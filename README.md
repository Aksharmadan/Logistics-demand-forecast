# Smart Demand Forecasting in Transportation and Logistics (ML)

> **Premium UI (recommended):** **NexRoute Pulse** — Next.js in **`web/`**. From the **repo root** you can run everything without `cd` into subfolders:
>
> ```bash
> # one-time: Python deps
> npm run bootstrap:backend
>
> # terminal 1 — API
> npm run dev:api
>
> # terminal 2 — UI (creates web/.env.local from .env.example if missing)
> npm run dev
> ```
>
> Then open **http://localhost:3000** (API on **http://127.0.0.1:8000**). The legacy Vite app in **`frontend/`** is optional.

End-to-end system: **FastAPI + PostgreSQL (or SQLite for local demos) + multi-model ML** backend, **Next.js or Vite** frontend, JWT auth, **WebSocket live stream**, intelligence APIs (insights, recommendations, scenarios), STL decomposition, **predict/rich** with confidence bands + explainability, anomaly alerts, CSV/PDF export, and simulated ingest.

## 1. Project overview (simple terms)

Operations and planning teams forecast **how much volume** (shipments, parcels, pallets, etc.) each **region** will need over the next days. The app:

1. Stores historical **date / region / demand** rows (CSV upload or simulated API).
2. **Trains** a machine learning model and saves it to disk (`backend/artifacts/`).
3. Serves **REST predictions** and **analytics** (trends, regional bars, heatmap-style grid).
4. Flags **anomalies** (unusual demand vs model expectation + isolation forest).
5. Exposes an **admin** UI for roles.

**Real-world use:** 3PL networks, courier “last mile” hubs, port drayage, retail DC replenishment—anywhere planners need short-horizon demand and early warning.

## 2. Tech stack

| Layer | Choice |
|--------|--------|
| Frontend | **Next.js 14** (`web/`) — Tailwind, Radix/shadcn-style UI, Recharts, Framer Motion, next-themes · legacy Vite in `frontend/` |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL (Docker / cloud) or **SQLite** (`sqlite:///./local.db`) for local quickstart |
| ML | pandas, NumPy, **HistGradientBoosting + optional XGBoost** (auto-select by RMSE), optional **Prophet** aggregate benchmark, **IsolationForest** anomalies, per-region residual σ → **95% bands**, feature importance + narrative XAI · joblib artifacts |
| Auth | JWT (HS256), bcrypt passwords |

## 3. System features (mapped to code)

| Feature | Where |
|---------|--------|
| Demand dashboard | `frontend/src/pages/DashboardPage.tsx`, `GET /analytics` |
| CSV upload | `POST /upload-data`, `UploadPage.tsx` |
| Real-time-style prediction | `POST /predict` after training |
| Historical trends | Line charts + `demand_over_time` |
| Region heatmap | Normalized weekly grid from `GET /analytics` → `heatmap` |
| High/low demand alerts | `POST /detect-anomalies`, `AnomalyAlert` model, Analytics alerts table |
| Admin panel | `GET/PATCH /admin/*`, `AdminPage.tsx` |
| Simulated live API | `POST /ingest/simulated` |
| Export | `GET /export/report?format=csv|pdf` |

## 4. Machine learning (how it works)

### Dataset structure (minimum)

| Column | Meaning |
|--------|---------|
| `date` | Calendar day of observation |
| `region` | Hub, city zone, lane, or DC code |
| `demand` | Units handled (orders, kg, TEU—stay consistent) |
| `sku` (optional) | Product family; upload aggregates per day/region |

CSV example: `data/sample_demand.csv`.

### Preprocessing

- Parse CSV → `DemandRecord` rows.
- Aggregate to **one row per (date, region)** (sums duplicate SKUs for that day).

### Feature engineering

- **Calendar:** day-of-week, month.
- **Lags:** 1-day and 7-day demand per region.
- **Rolling:** 7-day mean and std (shifted to avoid leakage).

### Model choice (and why)

**`HistGradientBoostingRegressor`** on the feature matrix:

- Handles **many regions in one model** via `region_code`.
- Strong accuracy on tabular time-series without heavy deep-learning ops.
- Easy to ship in containers (pure Python wheels).

**Alternatives you can swap in:** per-region **ARIMA** (statsmodels) as a baseline, **Prophet** for strong seasonality, **LSTM** if you sequence-window features—this repo keeps one clear default path; the API surface stays the same.

### Training & evaluation

- Time-ordered holdout split (no shuffling).
- Metrics: **RMSE**, **MAE** (see `TrainResponse` and `model_runs` table).
- **Save/load:** `joblib` bundle with model + `region_encoder` + feature list (`backend/app/ml/pipeline.py`).

### Prediction API

- `POST /predict` with `{ "horizon_days": 14 }` → recursive multi-step forecast per region.

## 5. Backend layout

```
backend/
  app/
    main.py              # FastAPI app, CORS, lifespan, seed users
    config.py
    database.py
    models.py            # User, DemandRecord, ModelRun, AnomalyAlert
    schemas.py
    security.py            # JWT + bcrypt
    deps.py
    ml/
      pipeline.py        # train, save, load, forecast_recursive
      anomaly.py         # residual z-score + IsolationForest
    routers/
      auth.py
      demand.py          # /upload-data, /train-model, /predict, /health
      analytics.py       # /analytics, /analytics/alerts
      ml_ops.py          # /detect-anomalies, /ingest/simulated
      export.py          # /export/report
      admin.py
  artifacts/             # model.joblib + metrics json (gitignored)
  requirements.txt
```

### Main routes

| Method | Path | Role |
|--------|------|------|
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| POST | `/upload-data` | analyst, admin |
| POST | `/train-model` | analyst, admin |
| POST | `/predict` | viewer, analyst, admin |
| GET | `/analytics` | authenticated |
| POST | `/detect-anomalies` | analyst, admin |
| POST | `/ingest/simulated` | analyst, admin |
| GET | `/export/report` | authenticated |
| GET/PATCH | `/admin/*` | admin |

### Database schema (SQLAlchemy)

- **users** — email, hashed_password, role (`admin` | `analyst` | `viewer`).
- **demand_records** — record_date, region, sku?, demand_quantity, source.
- **model_runs** — training metadata and artifact path.
- **anomaly_alerts** — scored exceptions with acknowledge flag.

## 6. Frontend layout

```
frontend/
  src/
    App.tsx
    main.tsx
    api/client.ts
    auth/AuthContext.tsx
    components/AppShell.tsx, KpiCard.tsx
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      UploadPage.tsx
      PredictionsPage.tsx
      AnalyticsPage.tsx
      AdminPage.tsx
```

Vite dev server proxies API paths to `http://127.0.0.1:8000` (see `vite.config.ts`). For production, set `VITE_API_URL` to your hosted API.

## 7. UI / UX

- **Palette:** slate neutrals + sky/brand blues (`tailwind.config.js`).
- **Motion:** subtle page and card transitions (Framer Motion).
- **KPI cards:** volume, growth, alerts.
- **Charts:** line (demand over time), horizontal bar (regions), CSS grid “heatmap.”

## 8. Local run (step-by-step)

### A. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL / SECRET_KEY if needed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Default `DATABASE_URL` in `app/config.py` is **`sqlite:///./local.db`** so you can start without Docker. For PostgreSQL:

```bash
docker compose up -d
# In .env:
# DATABASE_URL=postgresql+psycopg2://logistics:logistics@localhost:5432/logistics_forecast
```

### B. Frontend (NexRoute Pulse — Next.js)

```bash
cd web
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Open `http://localhost:3000`.

### B2. Legacy Vite UI (optional)

```bash
cd frontend && npm install && npm run dev
# http://localhost:5173 — add this origin to CORS_ORIGINS in backend .env if used
```

**Demo login** (seeded on first API start): `admin@logistics.demo` / `ChangeMe!2026`

### C. Train & predict (NexRoute Pulse)

1. **Data pipeline** — upload `data/sample_demand.csv`, then **Run ensemble training**.
2. **Forecast studio** — `POST /predict/rich` (confidence band + explain narrative).
3. **Intelligence lab** — insights, recommendations, scenario slider, **Run isolation scan**.
4. **Overview** — enable **Live stream** for WebSocket ticks (`/ws/live?token=…`).

## 9. Deployment

### Frontend (Vercel / Netlify) — Next.js

1. Root directory: **`web`**.
2. Build: `npm run build`, output: **`.next`** (Vercel auto-detects Next.js).
3. Env: `NEXT_PUBLIC_API_URL=https://your-api.example.com` (no trailing slash).

Legacy Vite: root **`frontend`**, output **`dist`**, env `VITE_API_URL`.

### Backend (Render / Railway)

1. **New Web Service** from repo; root `backend`.
2. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. **Env:** `DATABASE_URL` (managed Postgres), `SECRET_KEY` (long random), `CORS_ORIGINS=https://your-app.vercel.app`
4. Persistent disk or object storage recommended for `artifacts/` if you do not bake models into the image.

### Database (cloud)

- Use the provider’s **PostgreSQL** (Render/Railway/Neon/Supabase).
- Run migrations implicitly via `Base.metadata.create_all` on startup (fine for MVP); for production evolution, add Alembic.

## 10. Security notes for production

- Rotate `SECRET_KEY` and demo passwords.
- HTTPS everywhere; tighten `CORS_ORIGINS`.
- Move artifacts to durable storage; restrict `/admin` to VPN or IP allowlist if needed.

---

**Repository root:** `logistics-demand-forecast` under your `Projects` folder. The Cursor workspace root was moved to this project for implementation.

**GitHub:** [https://github.com/Aksharmadan/Logistics-demand-forecast](https://github.com/Aksharmadan/Logistics-demand-forecast)
