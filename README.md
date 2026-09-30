# Nepal Data Explorer

A national data platform for Nepal's economy, tourism, and demographics, built with Django and React. It provides interactive dashboards, AI-powered forecasts, comparative analytics, RSS news aggregation, and OAuth-based authentication.

![Index page](assets/indexpage.png)
![Predictions](assets/prediction.png)

## Features

- National and provincial dashboards for economic, tourism, and demographic data
- AI-powered forecasting with ARIMA/SARIMA models and confidence intervals
- Province comparison, dataset exploration, and PDF/CSV report exports, with the dataset catalogue filterable by Tourism, Economic, or both
- Authentication via Google and GitHub OAuth, JWT sessions, and email verification
- Custom toxicity moderation for support messages, backed by a DistilBERT classifier (trained for Nepali and English) with an additional bilingual profanity filter

## Technology Stack

| Layer     | Technologies                                                |
| --------- | ----------------------------------------------------------- |
| Backend   | Django, Django REST Framework, SimpleJWT, PostgreSQL        |
| Frontend  | React 18, Vite, TailwindCSS, Recharts, React Router, Leaflet |
| ML        | Custom DistilBERT toxicity classifier , ARIMA/SARIMA |

## Prerequisites

| Tool       | Version |
| ---------- | ------- |
| Python     | 3.11+   |
| Node.js    | 18+     |
| npm        | 9+      |
| PostgreSQL | 14+ (optional — a remote `DATABASE_URL` also works) |

## Getting Started

All paths below are relative to the project root `nepal-data-explorer/`. You will need **two terminals**: one for the backend (keep it running) and one for the frontend.

### 1. Backend

#### a) Create and activate a virtual environment

| OS       | Create                                    | Activate                              |
| -------- | ----------------------------------------- | ------------------------------------- |
| macOS/Linux | `python3 -m venv venv`                | `source venv/bin/activate`            |
| Windows (CMD) | `py -m venv venv`                    | `venv\Scripts\activate.bat`           |
| Windows (PowerShell) | `py -m venv venv`           | `venv\Scripts\Activate.ps1`           |

Run the **create** commands from the **project root** (`nepal-data-explorer/`), then activate. The virtual environment folder is created at `nepal-data-explorer/venv` and is used only by the backend.

#### b) Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

(When the venv is active, `python` and `pip` refer to the venv's versions.)

#### c) Create the environment file

The backend reads its configuration from a `.env` file **inside `backend/`**. Create it now — without this file the backend will not start:

```bash
cd backend   # if not already there
```

Create an empty `.env` file in `backend/`:

| OS | Command |
| --- | ------- |
| macOS/Linux | `touch .env` |
| Windows (CMD or PowerShell) | `type nul > .env` |

Then open `backend/.env` and paste the minimum example below, filling in your own values (generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(64))"`):

```ini
SECRET_KEY=replace-with-a-long-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://user:password@localhost:5432/nepal_data_explorer
FRONTEND_URL=http://localhost:5173
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=you@gmail.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/accounts/oauth/google/callback/
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:8000/accounts/oauth/github/callback/
```

#### d) Download the toxicity model (optional)

Only required if you want the support-message toxicity filter. The script lives at `scripts/download_toxicity_model.py` (project root, not `backend/`), so run it from the backend with a `../` path:

```bash
python ../scripts/download_toxicity_model.py
```

#### e) Set up the database and run migrations

Migrations create the tables the import data goes into.

- **Local PostgreSQL**: make sure the database exists first, e.g. `createdb nepal_data_explorer`, then set `DATABASE_URL` in `.env` to match it.
- **Remote (Neon)**: just set `DATABASE_URL` in `.env` to the connection string.

Then apply migrations:

```bash
python manage.py migrate
```

Run this again whenever the models change, and on every deploy: code that queries a table before its migration is applied fails at runtime.

#### f) Import the CSV data

Do this after migrations succeed:

```bash
python manage.py import_curated_datasets --set tourism --set population --set economic
python manage.py import_nationality_forecasts
python manage.py import_province_tourism
```

The province GDP CSV is **not bundled** with the repo — use your own file from the CBS series. Replace the path with the exact location of your file:

First, validate the file (this runs a **dry run — nothing is saved**, it only checks the file is readable and matches the expected columns):

```bash
python manage.py import_province_gdp /absolute/path/to/your/Province_wise_gdp_growth.csv --dry-run
```

If it passes without errors, drop `--dry-run` and run again — **this is the command that actually imports the data into the database**:

```bash
python manage.py import_province_gdp /absolute/path/to/your/Province_wise_gdp_growth.csv
```

#### g) Create a superuser (for the admin panel)

```bash
python manage.py createsuperuser
```

Run it interactively and enter the admin username, email, and password. The superuser grants access to Django's admin interface at `http://localhost:8000/admin/`.

#### h) Verify and run the backend

```bash
python manage.py check
python manage.py test
python manage.py runserver
```

The backend is available at `http://localhost:8000`. **Keep this terminal open and running.**

### 2. Frontend

Open a **new terminal** (the first one is busy running the backend), navigate to the **same project root** `nepal-data-explorer/`, and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and calls the API on the same origin. The Vite dev server proxies `/api`, `/accounts`, `/admin` and `/static` to the backend at `http://localhost:8000`, so no API base URL needs configuring and no CORS preflight is issued.

Private project.