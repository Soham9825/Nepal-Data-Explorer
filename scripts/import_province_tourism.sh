#!/usr/bin/env bash
set -euo pipefail
# Load the official Nepal Tourism Statistics per-destination CSV (2020-2025)
# into the Neon database (ProvinceTourismVisit table).
# Usage: ./scripts/import_province_tourism.sh [--dry-run] [--file /abs/path/to.csv]

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

VENV="$REPO_ROOT/backend/venv/bin/activate"
if [ -f "$VENV" ]; then
  # shellcheck disable=SC1090
  source "$VENV"
fi

echo "Running migrations..."
python backend/manage.py migrate

echo "Importing province tourism visits..."
python backend/manage.py import_province_tourism "$@"

echo "Verification:"
python backend/manage.py shell -c "
from datasets.models import ProvinceTourismVisit
from django.db.models import Min, Max, Count
qs = ProvinceTourismVisit.objects
print('province_tourism_visits:', qs.count())
print('years:', qs.aggregate(min_year=Min('year'), max_year=Max('year'), rows=Count('id')))
print('provinces:', sorted(set(qs.values_list('province', flat=True))))
print('destinations:', qs.values('destination').distinct().count())
"

echo "Import complete."
