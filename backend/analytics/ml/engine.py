from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .features import FeatureConfig, build_feature_frame, build_next_feature_row, default_feature_config


@dataclass
class TrainingOutcome:
    model: Pipeline
    feature_columns: list[str]
    feature_config: FeatureConfig
    test_frame: pd.DataFrame
    test_predictions: list[float]
    baseline_predictions: list[float]
    metrics: dict[str, float | int | None]
    residual_std: float
    train_size: int
    test_size: int


@dataclass
class ForecastBundle:
    model: Pipeline
    feature_columns: list[str]
    feature_config: FeatureConfig
    frequency: str
    residual_std: float
    series_name: str
    series_key: str
    target_field: str
    period_kind: str


def _mae(y_true: Iterable[float], y_pred: Iterable[float]) -> float:
    values = np.asarray(list(y_true), dtype=float) - np.asarray(list(y_pred), dtype=float)
    return float(np.mean(np.abs(values)))


def _rmse(y_true: Iterable[float], y_pred: Iterable[float]) -> float:
    values = np.asarray(list(y_true), dtype=float) - np.asarray(list(y_pred), dtype=float)
    return float(np.sqrt(np.mean(values ** 2)))


def _mape(y_true: Iterable[float], y_pred: Iterable[float]) -> float | None:
    actual = np.asarray(list(y_true), dtype=float)
    predicted = np.asarray(list(y_pred), dtype=float)
    mask = actual != 0
    if not np.any(mask):
        return None
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100.0)


def _smape(y_true: Iterable[float], y_pred: Iterable[float]) -> float:
    actual = np.asarray(list(y_true), dtype=float)
    predicted = np.asarray(list(y_pred), dtype=float)
    denominator = np.abs(actual) + np.abs(predicted)
    mask = denominator != 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(2.0 * np.abs(predicted[mask] - actual[mask]) / denominator[mask]) * 100.0)


def _seasonal_lag(frequency: str) -> int:
    return 12 if frequency == "M" else 1


def _next_period(period: pd.Timestamp, frequency: str) -> pd.Timestamp:
    if frequency == "M":
        return period + pd.DateOffset(months=1)
    return period + pd.DateOffset(years=1)


def _format_period_label(period: pd.Timestamp, frequency: str, period_kind: str) -> str:
    if period_kind == "monthly":
        return period.strftime("%Y-%m")
    if period_kind == "fiscal":
        start_year = period.year
        return f"{start_year}/{str((start_year + 1) % 100).zfill(2)}"
    return str(period.year)


def _evaluate_baseline(history_values: list[float], next_periods: list[pd.Timestamp], frequency: str) -> list[float]:
    predictions: list[float] = []
    seasonal = _seasonal_lag(frequency)

    for _ in next_periods:
        if len(history_values) >= seasonal:
            prediction = float(history_values[-seasonal])
        else:
            prediction = float(history_values[-1])
        predictions.append(prediction)
        history_values.append(prediction)

    return predictions


def train_one_series(
    series_frame: pd.DataFrame,
    *,
    series_name: str,
    series_key: str,
    target_field: str,
    frequency: str,
    period_kind: str,
    horizon: int,
) -> TrainingOutcome:
    feature_config = default_feature_config(frequency)
    frame = series_frame.sort_values("period").reset_index(drop=True).copy()
    frame["value"] = frame["value"].astype(float)
    feature_frame = build_feature_frame(frame, frequency, feature_config)

    if len(feature_frame) < max(8, horizon + 2):
        raise ValueError(
            f"Not enough rows to train {series_name}:{series_key}. Need at least {max(8, horizon + 2)} rows, got {len(feature_frame)}."
        )

    test_size = min(max(2, horizon), max(2, len(feature_frame) // 5))
    test_size = min(test_size, len(feature_frame) - 1)

    train_frame = feature_frame.iloc[:-test_size].reset_index(drop=True)
    test_frame = feature_frame.iloc[-test_size:].reset_index(drop=True)
    feature_columns = [column for column in train_frame.columns if column not in {"series_key", "period", "period_label", "value"}]

    model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=1.0)),
        ]
    )
    model.fit(train_frame[feature_columns], train_frame["value"])

    history_values = train_frame["value"].tolist()
    validation_predictions: list[float] = []
    baseline_predictions: list[float] = []
    actual_values: list[float] = []
    rolling_history = history_values.copy()

    for row in test_frame.itertuples(index=False):
        next_row = build_next_feature_row(
            rolling_history,
            row.period,
            len(rolling_history),
            frequency,
            feature_config,
        )
        prediction = float(model.predict(pd.DataFrame([next_row], columns=feature_columns))[0])
        validation_predictions.append(prediction)
        actual_values.append(float(row.value))
        rolling_history.append(prediction)

    baseline_history = history_values.copy()
    for row in test_frame.itertuples(index=False):
        seasonal = _seasonal_lag(frequency)
        if len(baseline_history) >= seasonal:
            prediction = float(baseline_history[-seasonal])
        else:
            prediction = float(baseline_history[-1])
        baseline_predictions.append(prediction)
        baseline_history.append(prediction)

    residuals = np.asarray(actual_values, dtype=float) - np.asarray(validation_predictions, dtype=float)
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else float(np.std(residuals))

    model_metrics = {
        "mae": _mae(actual_values, validation_predictions),
        "rmse": _rmse(actual_values, validation_predictions),
        "mape": _mape(actual_values, validation_predictions),
        "smape": _smape(actual_values, validation_predictions),
    }
    baseline_metrics = {
        "mae": _mae(actual_values, baseline_predictions),
        "rmse": _rmse(actual_values, baseline_predictions),
        "mape": _mape(actual_values, baseline_predictions),
        "smape": _smape(actual_values, baseline_predictions),
    }

    metrics = {
        "model": model_metrics,
        "baseline": baseline_metrics,
        "n_rows": int(len(feature_frame)),
        "train_rows": int(len(train_frame)),
        "test_rows": int(len(test_frame)),
    }

    return TrainingOutcome(
        model=model,
        feature_columns=feature_columns,
        feature_config=feature_config,
        test_frame=test_frame[["series_key", "period", "period_label", "value"]].copy(),
        test_predictions=validation_predictions,
        baseline_predictions=baseline_predictions,
        metrics=metrics,
        residual_std=residual_std,
        train_size=len(train_frame),
        test_size=len(test_frame),
    )


def forecast_future(
    bundle: ForecastBundle,
    history_frame: pd.DataFrame,
    horizon: int,
) -> pd.DataFrame:
    history = history_frame.sort_values("period").reset_index(drop=True).copy()
    history_values = history["value"].astype(float).tolist()
    last_period = history.iloc[-1]["period"]

    rows: list[dict[str, object]] = []
    current_period = last_period

    for step in range(1, horizon + 1):
        current_period = _next_period(current_period, bundle.frequency)
        next_row = build_next_feature_row(
            history_values,
            current_period,
            len(history_values),
            bundle.frequency,
            bundle.feature_config,
        )
        prediction = float(bundle.model.predict(pd.DataFrame([next_row], columns=bundle.feature_columns))[0])
        history_values.append(prediction)
        spread = 1.96 * bundle.residual_std if bundle.residual_std else 0.0

        rows.append(
            {
                "series_key": bundle.series_key,
                "period": current_period,
                "period_label": _format_period_label(current_period, bundle.frequency, bundle.period_kind),
                "step_ahead": step,
                "predicted_value": prediction,
                "lower_bound": prediction - spread if spread else prediction,
                "upper_bound": prediction + spread if spread else prediction,
                "split": "future",
            }
        )

    return pd.DataFrame(rows)
