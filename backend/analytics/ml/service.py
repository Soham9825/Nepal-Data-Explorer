from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd
from django.db import transaction

from analytics.models import ForecastArtifact, ForecastPoint

from .catalog import SERIES_DEFINITIONS, SeriesDefinition, get_series_definitions
from .engine import ForecastBundle, forecast_future, train_one_series
from .storage import absolute_model_path, build_model_path, relative_model_path, save_bundle


@dataclass
class SeriesRunResult:
    artifact: ForecastArtifact
    validation_points: list[ForecastPoint]
    future_points: list[ForecastPoint]


class ForecastService:
    def train_definition(self, definition: SeriesDefinition) -> list[SeriesRunResult]:
        frame = definition.loader()
        if frame.empty:
            return []

        results: list[SeriesRunResult] = []
        for series_key, series_frame in frame.groupby("series_key"):
            if len(series_frame) < definition.min_points:
                continue

            training = train_one_series(
                series_frame,
                series_name=definition.name,
                series_key=str(series_key),
                target_field=definition.target_field,
                frequency=definition.frequency,
                period_kind=definition.period_kind,
                horizon=definition.horizon,
            )

            model_path = build_model_path(definition.name, str(series_key))
            bundle = ForecastBundle(
                model=training.model,
                feature_columns=training.feature_columns,
                feature_config=training.feature_config,
                frequency=definition.frequency,
                residual_std=training.residual_std,
                series_name=definition.name,
                series_key=str(series_key),
                target_field=definition.target_field,
                period_kind=definition.period_kind,
            )
            save_bundle(
                {
                    "model": bundle.model,
                    "feature_columns": bundle.feature_columns,
                    "feature_config": bundle.feature_config,
                    "frequency": bundle.frequency,
                    "residual_std": bundle.residual_std,
                    "series_name": bundle.series_name,
                    "series_key": bundle.series_key,
                    "target_field": bundle.target_field,
                    "period_kind": bundle.period_kind,
                },
                model_path,
            )

            artifact = ForecastArtifact.objects.create(
                series_name=definition.name,
                series_key=str(series_key),
                model_name="RidgeLagForecaster",
                frequency=definition.frequency,
                target_field=definition.target_field,
                group_fields=[],
                horizon=definition.horizon,
                train_start=str(training.test_frame.iloc[0]["period"].date()) if not training.test_frame.empty else "",
                train_end=str(training.test_frame.iloc[-1]["period"].date()) if not training.test_frame.empty else "",
                test_start=str(training.test_frame.iloc[0]["period"].date()) if not training.test_frame.empty else "",
                test_end=str(training.test_frame.iloc[-1]["period"].date()) if not training.test_frame.empty else "",
                metrics=training.metrics,
                feature_config={"lags": list(training.feature_config.lags), "windows": list(training.feature_config.windows)},
                residual_std=training.residual_std,
                model_path=relative_model_path(model_path),
                status="trained",
                is_active=True,
                notes=definition.description,
            )

            validation_points = self._store_validation_points(
                artifact,
                series_key=str(series_key),
                test_frame=training.test_frame,
                predictions=training.test_predictions,
            )
            future_points = self._store_future_points(
                artifact,
                bundle,
                series_frame,
                definition.horizon,
            )

            results.append(
                SeriesRunResult(
                    artifact=artifact,
                    validation_points=validation_points,
                    future_points=future_points,
                )
            )

        return results

    def train_many(self, series_names: list[str] | None = None) -> list[SeriesRunResult]:
        results: list[SeriesRunResult] = []
        for definition in get_series_definitions(series_names):
            results.extend(self.train_definition(definition))
        return results

    def rebuild_future_points(self, artifact: ForecastArtifact) -> list[ForecastPoint]:
        model_path = absolute_model_path(artifact.model_path)
        bundle = self._load_bundle(model_path)
        definition = SERIES_DEFINITIONS.get(artifact.series_name)
        if definition is None:
            raise ValueError(f"Unknown series definition: {artifact.series_name}")

        series_frame = definition.loader()
        series_frame = series_frame[series_frame["series_key"] == artifact.series_key]
        if series_frame.empty:
            raise ValueError(f"No source rows found for {artifact.series_name}:{artifact.series_key}")

        ForecastPoint.objects.filter(artifact=artifact, split="future").delete()
        return self._store_future_points(artifact, bundle, series_frame, artifact.horizon)

    def _load_bundle(self, model_path: Path) -> ForecastBundle:
        from .storage import load_bundle

        payload = load_bundle(model_path)
        return ForecastBundle(
            model=payload["model"],
            feature_columns=list(payload["feature_columns"]),
            feature_config=payload["feature_config"],
            frequency=payload["frequency"],
            residual_std=float(payload.get("residual_std") or 0.0),
            series_name=payload["series_name"],
            series_key=payload["series_key"],
            target_field=payload["target_field"],
            period_kind=payload["period_kind"],
        )

    def _store_validation_points(
        self,
        artifact: ForecastArtifact,
        *,
        series_key: str,
        test_frame: pd.DataFrame,
        predictions: list[float],
    ) -> list[ForecastPoint]:
        points: list[ForecastPoint] = []
        for row, prediction in zip(test_frame.itertuples(index=False), predictions, strict=True):
            points.append(
                ForecastPoint(
                    artifact=artifact,
                    series_key=series_key,
                    period_label=str(row.period_label),
                    period_start=row.period.date(),
                    period_end=None,
                    step_ahead=0,
                    actual_value=float(row.value),
                    predicted_value=float(prediction),
                    lower_bound=None,
                    upper_bound=None,
                    split="validation",
                )
            )
        ForecastPoint.objects.bulk_create(points)
        return points

    def _store_future_points(
        self,
        artifact: ForecastArtifact,
        bundle: ForecastBundle,
        series_frame: pd.DataFrame,
        horizon: int,
    ) -> list[ForecastPoint]:
        forecast_frame = forecast_future(bundle, series_frame, horizon)
        points: list[ForecastPoint] = []
        for row in forecast_frame.itertuples(index=False):
            points.append(
                ForecastPoint(
                    artifact=artifact,
                    series_key=row.series_key,
                    period_label=row.period_label,
                    period_start=row.period.date(),
                    period_end=None,
                    step_ahead=int(row.step_ahead),
                    actual_value=None,
                    predicted_value=float(row.predicted_value),
                    lower_bound=float(row.lower_bound),
                    upper_bound=float(row.upper_bound),
                    split=row.split,
                )
            )
        ForecastPoint.objects.bulk_create(points)
        return points


forecast_service = ForecastService()
