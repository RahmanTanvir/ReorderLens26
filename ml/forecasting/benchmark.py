from __future__ import annotations

import argparse
import hashlib
import json
import platform
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pyarrow.parquet as pq


SEED = 20261114
SERIES_COUNT = 50_000
TRAIN_DAYS = 90
EVAL_DAYS = 7


@dataclass(frozen=True)
class Metrics:
    observations: int
    series: int
    mae: float
    wape: float | None
    bias: float | None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(train_path: Path, eval_path: Path) -> dict[str, np.ndarray]:
    columns = [
        "store_id",
        "product_id",
        "dt",
        "sale_amount",
        "stock_hour6_22_cnt",
        "discount",
        "activity_flag",
    ]
    train = pq.read_table(train_path, columns=columns)
    evaluation = pq.read_table(eval_path, columns=columns)
    expected_train = SERIES_COUNT * TRAIN_DAYS
    expected_eval = SERIES_COUNT * EVAL_DAYS
    if train.num_rows != expected_train or evaluation.num_rows != expected_eval:
        raise RuntimeError("Unexpected FreshRetailNet row count")

    def matrix(table: object, name: str, days: int, dtype: object) -> np.ndarray:
        values = table[name].to_numpy(zero_copy_only=False).astype(dtype, copy=False)
        return values.reshape(SERIES_COUNT, days)

    train_store = matrix(train, "store_id", TRAIN_DAYS, np.int32)
    eval_store = matrix(evaluation, "store_id", EVAL_DAYS, np.int32)
    train_product = matrix(train, "product_id", TRAIN_DAYS, np.int32)
    eval_product = matrix(evaluation, "product_id", EVAL_DAYS, np.int32)
    if not (
        np.all(train_store == train_store[:, :1])
        and np.all(train_product == train_product[:, :1])
        and np.array_equal(train_store[:, 0], eval_store[:, 0])
        and np.array_equal(train_product[:, 0], eval_product[:, 0])
    ):
        raise RuntimeError("Series are not aligned across splits")

    train_dates = np.asarray(train["dt"]).reshape(SERIES_COUNT, TRAIN_DAYS)
    eval_dates = np.asarray(evaluation["dt"]).reshape(SERIES_COUNT, EVAL_DAYS)
    if not (
        np.all(train_dates == train_dates[:1])
        and np.all(eval_dates == eval_dates[:1])
    ):
        raise RuntimeError("Series do not share the documented calendar")

    sales = np.concatenate(
        [
            matrix(train, "sale_amount", TRAIN_DAYS, np.float32),
            matrix(evaluation, "sale_amount", EVAL_DAYS, np.float32),
        ],
        axis=1,
    )
    stockout = np.concatenate(
        [
            matrix(train, "stock_hour6_22_cnt", TRAIN_DAYS, np.int16) > 0,
            matrix(evaluation, "stock_hour6_22_cnt", EVAL_DAYS, np.int16) > 0,
        ],
        axis=1,
    )
    discount = np.concatenate(
        [
            matrix(train, "discount", TRAIN_DAYS, np.float32),
            matrix(evaluation, "discount", EVAL_DAYS, np.float32),
        ],
        axis=1,
    )
    activity = np.concatenate(
        [
            matrix(train, "activity_flag", TRAIN_DAYS, np.int8),
            matrix(evaluation, "activity_flag", EVAL_DAYS, np.int8),
        ],
        axis=1,
    )
    promo = (activity > 0) | (discount < 0.9999)
    dates = np.concatenate([train_dates[0], eval_dates[0]])
    weekdays = np.array(
        [np.datetime64(value).astype("datetime64[D]").astype(int) % 7 for value in dates],
        dtype=np.int8,
    )
    return {
        "sales": sales,
        "stockout": stockout,
        "promo": promo,
        "weekdays": weekdays,
        "dates": dates,
    }


def masked_mean(values: np.ndarray, eligible: np.ndarray) -> np.ndarray:
    count = eligible.sum(axis=1)
    total = np.where(eligible, values, 0.0).sum(axis=1)
    return np.divide(
        total,
        count,
        out=np.zeros_like(total, dtype=np.float32),
        where=count > 0,
    ).astype(np.float32)


def baseline_for(
    sales: np.ndarray,
    stockout: np.ndarray,
    weekdays: np.ndarray,
    cutoff: int,
    horizon: int,
) -> np.ndarray:
    history = sales[:, cutoff - 27 : cutoff + 1]
    eligible = ~stockout[:, cutoff - 27 : cutoff + 1]
    history_weekdays = weekdays[cutoff - 27 : cutoff + 1]
    target_weekday = weekdays[cutoff + horizon]
    same = eligible & (history_weekdays[None, :] == target_weekday)
    same_count = same.sum(axis=1)
    return np.where(
        same_count >= 2,
        masked_mean(history, same),
        masked_mean(history, eligible),
    ).astype(np.float32)


def features_for(
    sales: np.ndarray,
    stockout: np.ndarray,
    promo: np.ndarray,
    weekdays: np.ndarray,
    cutoff: int,
    horizon: int,
    indices: np.ndarray,
) -> tuple[np.ndarray, list[str], np.ndarray]:
    history = sales[indices, cutoff - 27 : cutoff + 1]
    history_stockout = stockout[indices, cutoff - 27 : cutoff + 1]
    history_promo = promo[indices, cutoff - 27 : cutoff + 1]
    eligible = ~history_stockout
    raw_scale = masked_mean(history, eligible)
    scale = np.where(raw_scale > 0.01, raw_scale, 1.0).astype(np.float32)
    normalized_history = history / scale[:, None]
    columns: list[np.ndarray] = []
    names: list[str] = []

    for lag in (1, 2, 3, 4, 5, 6, 7, 14, 21, 28):
        columns.extend(
            [
                normalized_history[:, -lag],
                history_stockout[:, -lag].astype(np.float32),
                history_promo[:, -lag].astype(np.float32),
            ]
        )
        names.extend([f"sales_lag_{lag}", f"stockout_lag_{lag}", f"promo_lag_{lag}"])

    for window in (7, 14, 28):
        window_sales = normalized_history[:, -window:]
        window_eligible = eligible[:, -window:]
        window_promo = history_promo[:, -window:]
        mean = masked_mean(window_sales, window_eligible)
        centered = np.where(window_eligible, window_sales - mean[:, None], 0.0)
        count = window_eligible.sum(axis=1)
        std = np.sqrt(
            np.divide(
                np.square(centered).sum(axis=1),
                count,
                out=np.zeros_like(mean),
                where=count > 0,
            )
        ).astype(np.float32)
        columns.extend(
            [
                mean,
                std,
                count.astype(np.float32),
                history_stockout[:, -window:].sum(axis=1).astype(np.float32),
                window_promo.sum(axis=1).astype(np.float32),
            ]
        )
        names.extend(
            [
                f"eligible_mean_{window}",
                f"eligible_std_{window}",
                f"eligible_count_{window}",
                f"stockout_count_{window}",
                f"promo_count_{window}",
            ]
        )

    target_weekday = int(weekdays[cutoff + horizon])
    history_weekdays = weekdays[cutoff - 27 : cutoff + 1]
    same = eligible & (history_weekdays[None, :] == target_weekday)
    same_count = same.sum(axis=1)
    same_mean = masked_mean(normalized_history, same)
    overall_mean = masked_mean(normalized_history, eligible)
    baseline = np.where(same_count >= 2, same_mean, overall_mean).astype(np.float32)
    angle = 2.0 * np.pi * target_weekday / 7.0
    columns.extend(
        [
            same_mean,
            same_count.astype(np.float32),
            baseline,
            (masked_mean(normalized_history[:, -7:], eligible[:, -7:]) - masked_mean(normalized_history[:, -14:-7], eligible[:, -14:-7])).astype(np.float32),
            np.full(len(indices), horizon, dtype=np.float32),
            np.full(len(indices), np.sin(angle), dtype=np.float32),
            np.full(len(indices), np.cos(angle), dtype=np.float32),
        ]
    )
    names.extend(
        [
            "same_weekday_mean",
            "same_weekday_count",
            "seasonal_baseline",
            "recent_trend",
            "horizon_day",
            "weekday_sin",
            "weekday_cos",
        ]
    )
    return np.column_stack(columns).astype(np.float32), names, scale


def forecast_matrix(
    data: dict[str, np.ndarray],
    cutoff: int,
    model: lgb.LGBMRegressor | None,
) -> dict[str, np.ndarray]:
    all_indices = np.arange(SERIES_COUNT)
    actual = data["sales"][:, cutoff + 1 : cutoff + 8]
    target_stockout = data["stockout"][:, cutoff + 1 : cutoff + 8]
    history_stockout = data["stockout"][:, cutoff - 27 : cutoff + 1].any(axis=1)
    baseline = np.column_stack(
        [
            baseline_for(data["sales"], data["stockout"], data["weekdays"], cutoff, horizon)
            for horizon in range(1, 8)
        ]
    )
    moving = np.repeat(
        masked_mean(
            data["sales"][:, cutoff - 6 : cutoff + 1],
            ~data["stockout"][:, cutoff - 6 : cutoff + 1],
        )[:, None],
        7,
        axis=1,
    )
    naive = np.column_stack(
        [data["sales"][:, cutoff + horizon - 7] for horizon in range(1, 8)]
    )
    result = {
        "actual": actual,
        "target_stockout": target_stockout,
        "history_stockout": history_stockout,
        "seasonal_baseline_v1": baseline,
        "eligible_mean_7": moving,
        "seasonal_naive_7": naive,
    }
    if model is not None:
        predicted = []
        for horizon in range(1, 8):
            features, _, scale = features_for(
                data["sales"],
                data["stockout"],
                data["promo"],
                data["weekdays"],
                cutoff,
                horizon,
                all_indices,
            )
            predicted.append(np.maximum(0.0, model.predict(features)).astype(np.float32) * scale)
        result["stockout_lgbm_ratio_v1"] = np.column_stack(predicted)
    return result


def score(actual: np.ndarray, predicted: np.ndarray, mask: np.ndarray) -> Metrics:
    y = actual[mask].astype(np.float64)
    p = predicted[mask].astype(np.float64)
    denominator = float(np.abs(y).sum())
    series = int(np.count_nonzero(mask.any(axis=1)))
    return Metrics(
        observations=int(mask.sum()),
        series=series,
        mae=float(np.abs(p - y).mean()),
        wape=float(np.abs(p - y).sum() / denominator) if denominator > 0 else None,
        bias=float((p - y).sum() / denominator) if denominator > 0 else None,
    )


def score_forecast(result: dict[str, np.ndarray]) -> dict[str, object]:
    actual = result["actual"]
    uncensored = ~result["target_stockout"]
    stock_history = result["history_stockout"][:, None]
    segments = {
        "uncensored_targets": uncensored,
        "uncensored_targets_stockout_history": uncensored & stock_history,
        "uncensored_targets_no_stockout_history": uncensored & ~stock_history,
        "all_observed_sales": np.ones_like(uncensored, dtype=bool),
    }
    scored: dict[str, object] = {}
    for method, predicted in result.items():
        if method in {"actual", "target_stockout", "history_stockout"}:
            continue
        scored[method] = {
            segment: asdict(score(actual, predicted, mask))
            for segment, mask in segments.items()
        }
    return scored


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark ReorderLens forecasting candidates.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("artifacts/ml-evaluation/data"),
        help="Directory containing FreshRetailNet-50K train.parquet and eval.parquet.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("artifacts/ml-evaluation/run"),
        help="Ignored directory for the report and native LightGBM model.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    train_path = args.data_dir / "train.parquet"
    eval_path = args.data_dir / "eval.parquet"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    data = load(train_path, eval_path)
    rng = np.random.default_rng(SEED)
    training_series = np.sort(rng.choice(SERIES_COUNT, size=20_000, replace=False))
    train_features: list[np.ndarray] = []
    train_targets: list[np.ndarray] = []
    feature_names: list[str] | None = None
    # Labels end on day 75. Days 76-82 are validation, 83-89 test, and
    # the owner-published eval split (days 90-96) stays untouched until final scoring.
    for cutoff in (27, 34, 41, 48, 55, 62, 68):
        for horizon in range(1, 8):
            features, names, scale = features_for(
                data["sales"],
                data["stockout"],
                data["promo"],
                data["weekdays"],
                cutoff,
                horizon,
                training_series,
            )
            target_day = cutoff + horizon
            target = data["sales"][training_series, target_day]
            uncensored = ~data["stockout"][training_series, target_day]
            train_features.append(features[uncensored])
            train_targets.append((target / scale)[uncensored])
            feature_names = names
    x_train = np.concatenate(train_features)
    y_train = np.concatenate(train_targets)

    validation = forecast_matrix(data, 75, None)
    validation_indices = np.repeat(np.arange(SERIES_COUNT), 7)
    validation_features = []
    for horizon in range(1, 8):
        features, _, scale = features_for(
            data["sales"],
            data["stockout"],
            data["promo"],
            data["weekdays"],
            75,
            horizon,
            np.arange(SERIES_COUNT),
        )
        validation_features.append(features)
        if horizon == 1:
            validation_scales = scale[:, None]
        else:
            validation_scales = np.column_stack([validation_scales, scale])
    x_validation = np.stack(validation_features, axis=1).reshape(-1, x_train.shape[1])
    y_validation = (validation["actual"] / validation_scales).reshape(-1)
    validation_uncensored = (~validation["target_stockout"]).reshape(-1)
    del validation_indices

    model = lgb.LGBMRegressor(
        objective="regression_l1",
        n_estimators=500,
        learning_rate=0.04,
        num_leaves=31,
        max_depth=8,
        min_child_samples=250,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        random_state=SEED,
        deterministic=True,
        force_col_wise=True,
        n_jobs=-1,
        verbosity=-1,
    )
    fit_started = time.perf_counter()
    model.fit(
        x_train,
        y_train,
        eval_X=x_validation[validation_uncensored],
        eval_y=y_validation[validation_uncensored],
        eval_metric="l1",
        callbacks=[lgb.early_stopping(30, verbose=False)],
    )
    fit_seconds = time.perf_counter() - fit_started

    results: dict[str, object] = {}
    latency: dict[str, float] = {}
    validation_forecast = forecast_matrix(data, 75, model)
    calibration_mask = ~validation_forecast["target_stockout"]
    calibration_denominator = float(validation_forecast["stockout_lgbm_ratio_v1"][calibration_mask].sum())
    calibration_factor = (
        float(validation_forecast["actual"][calibration_mask].sum()) / calibration_denominator
        if calibration_denominator > 0
        else 1.0
    )
    for label, cutoff in (("validation", 75), ("test", 82), ("official_eval", 89)):
        prediction_started = time.perf_counter()
        forecast = validation_forecast if cutoff == 75 else forecast_matrix(data, cutoff, model)
        forecast["stockout_lgbm_ratio_calibrated_v1"] = (
            forecast["stockout_lgbm_ratio_v1"] * calibration_factor
        )
        latency[label] = time.perf_counter() - prediction_started
        results[label] = {
            "cutoff": str(data["dates"][cutoff]),
            "target_start": str(data["dates"][cutoff + 1]),
            "target_end": str(data["dates"][cutoff + 7]),
            "metrics": score_forecast(forecast),
        }

    model_path = args.output_dir / "stockout_lgbm_ratio_v1.txt"
    model.booster_.save_model(model_path)
    report = {
        "status": "experimental_offline_only",
        "seed": SEED,
        "dataset": {
            "name": "FreshRetailNet-50K v1.0",
            "license": "CC BY 4.0",
            "source": "https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K",
            "train_rows": SERIES_COUNT * TRAIN_DAYS,
            "eval_rows": SERIES_COUNT * EVAL_DAYS,
            "series": SERIES_COUNT,
            "train_sha256": sha256(train_path),
            "eval_sha256": sha256(eval_path),
        },
        "protocol": {
            "history_days": 28,
            "forecast_horizon_days": 7,
            "training_series": len(training_series),
            "training_rows_after_uncensored_filter": int(len(y_train)),
            "validation_target_days": 7,
            "test_target_days": 7,
            "official_eval_target_days": 7,
            "target_rule": "Train and primary-score only days with zero recorded stockout hours; history may contain stockouts.",
            "leakage_control": "Every feature uses only the 28 days at or before its cutoff; future availability and promotion values are excluded.",
        },
        "model": {
            "name": "stockout_lgbm_ratio_v1",
            "library": f"lightgbm {lgb.__version__}",
            "features": feature_names,
            "best_iteration": int(model.best_iteration_),
            "validation_calibration_factor": calibration_factor,
            "model_bytes": model_path.stat().st_size,
            "fit_seconds": fit_seconds,
            "prediction_seconds_350k_rows": latency,
        },
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "numpy": np.__version__,
        },
        "results": results,
        "limitations": [
            "Observed sales on target days are not verified latent demand.",
            "Stockout-affected target days are excluded from the primary metrics, so the benchmark tests forecasting after censored histories rather than lost-sales reconstruction.",
            "The data covers Chinese fresh/perishable retail for 97 days and does not establish performance for ReorderLens customers in Bangladesh or other retail categories.",
            "The dataset has no on-hand inventory, supplier lead times, purchase costs, or budgets, so the existing replenishment planner cannot be independently evaluated on it.",
            "Only the seven-day workflow is qualified by this protocol; 14- and 28-day runtime integration would require separate held-out evidence.",
        ],
        "elapsed_seconds": time.perf_counter() - started,
    }
    (args.output_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()


