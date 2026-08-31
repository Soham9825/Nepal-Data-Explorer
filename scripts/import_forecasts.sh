#!/usr/bin/env bash
set -euo pipefail
# Simple helper to run the tourism_nationality CSV importer on the server
# Usage: ./scripts/import_forecasts.sh [--path /abs/path/to/file.csv]

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

VENV="$REPO_ROOT/backend/venv/bin/activate"
if [ -f "$VENV" ]; then
  # shellcheck disable=SC1090
  source "$VENV"
fi

echo "Running migrations..."
python backend/manage.py migrate

echo "Importing nationality forecasts..."
python backend/manage.py import_nationality_forecasts "$@"

echo "Verification:" 
python backend/manage.py shell -c "from datasets.models import DashboardForecast; print('tourism count:', DashboardForecast.objects.filter(domain='tourism').count())"

echo "Import complete."
