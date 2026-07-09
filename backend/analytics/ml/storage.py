from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

import joblib
from django.conf import settings


ARTIFACT_ROOT = Path(settings.BASE_DIR) / "artifacts" / "forecast_models"


def slugify_part(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-") or "series"


def build_model_path(series_name: str, series_key: str, artifact_id: str | None = None) -> Path:
    identifier = artifact_id or uuid4().hex
    directory = ARTIFACT_ROOT / slugify_part(series_name) / slugify_part(series_key)
    return directory / f"{identifier}.joblib"


def save_bundle(bundle: dict, model_path: Path) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)


def load_bundle(model_path: Path) -> dict:
    return joblib.load(model_path)


def relative_model_path(model_path: Path) -> str:
    return str(model_path.relative_to(Path(settings.BASE_DIR)))


def absolute_model_path(relative_path: str) -> Path:
    return Path(settings.BASE_DIR) / relative_path
