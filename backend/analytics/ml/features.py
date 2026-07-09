from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class FeatureConfig:
    lags: tuple[int, ...]
    windows: tuple[int, ...]


def default_feature_config(frequency: str) -> FeatureConfig:
    if frequency == "M":
        return FeatureConfig(lags=(1, 2, 3, 6, 12), windows=(3, 6, 12))
    return FeatureConfig(lags=(1, 2, 3), windows=(2, 3))


def _calendar_features(period: pd.Timestamp, frequency: str) -> dict[str, float]:
    features: dict[str, float] = {
        "year": float(period.year),
        "time_index": 0.0,
    }
    if frequency == "M":
        month = period.month
        features["month"] = float(month)
        features["month_sin"] = float(np.sin(2 * np.pi * month / 12.0))
        features["month_cos"] = float(np.cos(2 * np.pi * month / 12.0))
    return features


def build_feature_frame(df: pd.DataFrame, frequency: str, feature_config: FeatureConfig) -> pd.DataFrame:
    frame = df.sort_values("period").reset_index(drop=True).copy()
    frame["time_index"] = np.arange(len(frame), dtype=float)
    frame["year"] = frame["period"].dt.year.astype(float)

    if frequency == "M":
        frame["month"] = frame["period"].dt.month.astype(float)
        frame["month_sin"] = np.sin(2 * np.pi * frame["month"] / 12.0)
        frame["month_cos"] = np.cos(2 * np.pi * frame["month"] / 12.0)

    for lag in feature_config.lags:
        frame[f"lag_{lag}"] = frame["value"].shift(lag)

    for window in feature_config.windows:
        shifted = frame["value"].shift(1)
        frame[f"rolling_mean_{window}"] = shifted.rolling(window).mean()
        frame[f"rolling_std_{window}"] = shifted.rolling(window).std()

    feature_columns = [
        column
        for column in frame.columns
        if column not in {"series_key", "period", "period_label", "value"}
    ]
    frame = frame.dropna(subset=feature_columns + ["value"]).reset_index(drop=True)
    return frame


def build_next_feature_row(
    history_values: Sequence[float],
    next_period: pd.Timestamp,
    next_index: int,
    frequency: str,
    feature_config: FeatureConfig,
) -> dict[str, float]:
    row = {
        "time_index": float(next_index),
        "year": float(next_period.year),
    }

    if frequency == "M":
        month = next_period.month
        row["month"] = float(month)
        row["month_sin"] = float(np.sin(2 * np.pi * month / 12.0))
        row["month_cos"] = float(np.cos(2 * np.pi * month / 12.0))

    history = list(history_values)
    for lag in feature_config.lags:
        row[f"lag_{lag}"] = float(history[-lag]) if len(history) >= lag else np.nan

    for window in feature_config.windows:
        if len(history) >= window:
            window_values = np.asarray(history[-window:], dtype=float)
            row[f"rolling_mean_{window}"] = float(window_values.mean())
            row[f"rolling_std_{window}"] = float(window_values.std(ddof=1)) if window > 1 else 0.0
        else:
            row[f"rolling_mean_{window}"] = np.nan
            row[f"rolling_std_{window}"] = np.nan

    return row
