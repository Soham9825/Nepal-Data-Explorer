# Nepal Data Explorer

An interactive data-exploration platform for Nepal's national statistical and
tourism datasets — population by province, economic indicators, tourist
arrivals, and ML-based tourism forecasts. Includes a CSV explorer, chart
comparisons, and an RSS-driven news feed.

## Tech Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 18, Vite 8, Tailwind CSS, Recharts, React Leaflet           |
| Backend    | Django 6, Django REST Framework, SimpleJWT, scikit-learn          |
| Database   | PostgreSQL (SQLite works for local development)                   |
| Auth       | JWT (access + refresh), Django sessions, Google / GitHub OAuth    |

## Repository Layout

```
.
├── backend/            # Django REST API (accounts, datasets, analytics, news)
│   └── manage.py
├── frontend/           # React SPA (Vite)
│   ├── dist/           # Production build output (generated, not committed)
│   └── src/
│       ├── pages/      # Route pages (National, Economic, Tourism, ...)
│       ├── components/ # Reusable UI and charts
│       └── utils/      # download helpers, icon maps, formatters
├── scripts/            # Ops helpers (e.g. import_forecasts.sh)
├── .env.example        # Template for environment configuration
└── .gitignore
```

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (optional — SQLite is fine for local development)
- [Optional] Google / GitHub OAuth credentials for social login

## Setup

### 1. Environment variables

Copy the template and fill in values:

```bash
cp .env.example .env
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # optional: staff/admin access
python manage.py runserver        # http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

The dev server proxies API requests to the backend. Configure a non-default
backend origin with:

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000
```

## Quality Gates

```bash
cd frontend
npm run lint        # ESLint
npm run format      # Prettier (write)
npm run test        # Vitest unit tests
npm run build       # Production build (type-safe, emitted to dist/)
```

Backend tests (Django):

```bash
cd backend
python manage.py test
```

## Scripts

- `scripts/import_forecasts.sh` — run migrations and import nationality
  forecast CSVs on the server:
  `./scripts/import_forecasts.sh --path /abs/path/to/file.csv`

## API Overview

| Path                    | Description                              |
| ----------------------- | ---------------------------------------- |
| `/accounts/…`           | Signup, login, OTP, OAuth, JWT refresh   |
| `/api/datasets/…`       | Dataset metadata + download files        |
| `/api/analytics/…`      | Population, economic, tourism, forecasts |
| `/api/news/…`           | RSS news feed                            |

## License

Private project. Not licensed for reuse.