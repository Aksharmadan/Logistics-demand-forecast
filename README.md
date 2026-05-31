# ForecastFlow AI — Logistics Intelligence Platform

Enterprise-grade AI-powered logistics demand forecasting, anomaly detection, fleet management, and operational intelligence.

## Stack

**Backend:** FastAPI · SQLAlchemy · XGBoost · LightGBM · Scikit-learn · WebSockets · SQLite/PostgreSQL  
**Frontend:** React 18 · TypeScript · Framer Motion · Recharts · Tailwind CSS · Vite

## Quick Start (Local)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

**Demo credentials:**
- Admin: `admin@logistics.demo` / `ChangeMe!2026`
- Analyst: `analyst@logistics.demo` / `ChangeMe!2026`

## Features

### Machine Learning
- **Ensemble forecasting**: XGBoost + LightGBM with inverse-RMSE weighting
- **25 engineered features**: lag (1/2/3/7/14/21/28d), rolling mean/std/min/max, EWM, trend slope, calendar features
- **Confidence intervals**: Residual-based, widening with forecast horizon
- **Anomaly detection**: Z-score + IsolationForest + IQR fence (3-signal)
- **Feature importance**: Ensemble-weighted, visualized in Forecasting Lab
- **Model registry**: All training runs tracked with RMSE/MAE/MAPE

### Platform
- **Operations Dashboard**: Live KPIs, demand charts, heatmap, AI insights, real-time event feed
- **Forecasting Lab**: Horizon control, confidence bands, per-region breakdown, model comparison, feature importance
- **Analytics**: Trend analysis, regional intelligence, anomaly workflow, CSV/PDF export
- **Fleet Management**: 40 simulated vehicles, utilization tracking, status management
- **AI Copilot**: Context-aware assistant answering operational questions using real data
- **Admin Console**: User management, RBAC, real audit log, system stats
- **Real-time**: WebSocket event bus broadcasting demand updates, anomaly alerts, vehicle events, AI insights

### UI
- Collapsible sidebar navigation
- Command palette (⌘K)
- Toast notification system
- Dark mode (default) / Light mode
- Framer Motion animations throughout
- Glassmorphism design system

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | JWT authentication |
| POST | `/upload-data` | CSV demand upload |
| POST | `/train-model` | Train XGBoost+LightGBM ensemble |
| POST | `/predict` | Generate forecast with confidence intervals |
| GET | `/model/feature-importance` | Feature importance scores |
| GET | `/model/runs` | Training history |
| GET | `/analytics` | Summary + charts data |
| GET | `/analytics/insights` | AI operational insights |
| GET | `/analytics/regional-breakdown` | Per-region stats |
| POST | `/detect-anomalies` | Run anomaly scan |
| POST | `/copilot` | AI Copilot query |
| GET | `/fleet` | Fleet vehicle list |
| GET | `/fleet/summary` | Fleet KPIs |
| WS | `/ws/live` | Real-time event stream |

## Docker

```bash
docker-compose up --build
```
