# Nepal Data Explorer

A national data platform for Nepal's economy, tourism, and demographics, built with Django and React. It provides interactive dashboards, AI-powered forecasts, comparative analytics, RSS news aggregation, and OAuth-based authentication.

![Index page](assets/indexpage.png)
![Predictions](assets/prediction.png)

## Features

- National and provincial dashboards for economic, tourism, and demographic data
- AI-powered forecasting with ARIMA/SARIMA models and confidence intervals
- Province comparison, dataset exploration, and PDF/CSV report exports
- Authentication via Google and GitHub OAuth, JWT sessions, and email verification
- Custom toxicity moderation for support messages, backed by a fine-tuned DistilBERT classifier (trained for Nepali and English) with an additional bilingual profanity filter

## Technology Stack

| Layer     | Technologies                                                |
| --------- | ----------------------------------------------------------- |
| Backend   | Django, Django REST Framework, SimpleJWT, PostgreSQL        |
| Frontend  | React 18, Vite, TailwindCSS, Recharts, React Router, Leaflet |
| ML        | Custom DistilBERT toxicity classifier (fine-tuned in Colab), ARIMA/SARIMA |

## Prerequisites

| Tool       | Version |
| ---------- | ------- |
| Python     | 3.11+   |
| Node.js    | 18+     |
| npm        | 9+      |
| PostgreSQL | 14+ (optional — a remote `DATABASE_URL` also works) |

## Getting Started

### 1. Backend

#### Create a virtual environment

| OS       | Command                                        |
| -------- | ---------------------------------------------- |
| macOS/Linux | `python3 -m venv venv`                          |
| Windows (CMD) | `py -m venv venv`                           |
| Windows (PowerShell) | `py -m venv venv`                 |

Activate it:

| OS       | Command                                   |
| -------- | ------------------------------------------ |
| macOS/Linux | `source venv/bin/activate`              |
| Windows (CMD) | `venv\Scripts\activate.bat`            |
| Windows (PowerShell) | `venv\Scripts\Activate.ps1`       |

#### Install dependencies and configure

```bash
cd backend
pip install -r requirements.txt
```

Copy the [minimum example](#environment-variables) below into a `.env` file inside `backend/` and adjust the values as needed.

Download the toxicity model weights. These are the trained weights for the project's custom DistilBERT toxicity detector (available as the `NepalDataExplorer-ToxicDetectorModel` repository on Hugging Face; override the repo with `TOXICITY_MODEL_ID` if you host a fork). Required for support-message moderation:

```bash
python scripts/download_toxicity_model.py
```

Apply migrations, run checks and tests, then start the server:

```bash
python manage.py migrate
python manage.py check
python manage.py test
python manage.py runserver
```

The backend is available at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the API at `http://localhost:8000`.

## Environment Variables

Create a `.env` file inside the `backend/` directory with the following minimum example. **The `.env` file is git-ignored — never commit it.** If you do, rotate every credential immediately, as values remain visible in git history even after deletion.

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

### Create the environment file

On macOS/Linux:

```bash
cd backend
touch .env
```

On Windows (CMD or PowerShell):

```
cd backend
type nul > .env
```

Then paste the example above into `.env` and fill in your own values (generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(64))"`).

### Create a superuser

```bash
cd backend
python manage.py createsuperuser
```

Run it interactively and enter the admin username, email, and password. The superuser grants access to Django's admin interface at `http://localhost:8000/admin/`.

Private project.