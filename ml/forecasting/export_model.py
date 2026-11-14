from __future__ import annotations

import argparse
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np


def flatten_tree(root: dict[str, object]) -> dict[str, list[float | int]]:
    features: list[int] = []
    thresholds: list[float] = []
    left: list[int] = []
    right: list[int] = []
    values: list[float] = []

    def visit(node: dict[str, object]) -> int:
        index = len(features)
        features.append(-1)
        thresholds.append(0.0)
        left.append(-1)
        right.append(-1)
        values.append(0.0)
        if "leaf_value" in node:
            values[index] = float(node["leaf_value"])
            return index
        if node.get("decision_type") != "<=":
            raise RuntimeError(f"Unsupported LightGBM decision type: {node.get('decision_type')}")
        features[index] = int(node["split_feature"])
        thresholds[index] = float(node["threshold"])
        left[index] = visit(node["left_child"])
        right[index] = visit(node["right_child"])
        return index

    visit(root)
    return {"f": features, "t": thresholds, "l": left, "r": right, "v": values}


def evaluate(trees: list[dict[str, list[float | int]]], row: np.ndarray) -> float:
    total = 0.0
    for tree in trees:
        index = 0
        while int(tree["f"][index]) >= 0:
            feature = int(tree["f"][index])
            index = int(tree["l"][index] if row[feature] <= tree["t"][index] else tree["r"][index])
        total += float(tree["v"][index])
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a compact dependency-free ReorderLens model artifact.")
    parser.add_argument("--model", type=Path, default=Path("artifacts/ml-evaluation/run/stockout_lgbm_ratio_v1.txt"))
    parser.add_argument("--report", type=Path, default=Path("artifacts/ml-evaluation/run/report.json"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/ml-evaluation/run/stockout_lgbm_ratio_v1.json"))
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    booster = lgb.Booster(model_file=str(args.model))
    dump = booster.dump_model()
    trees = [flatten_tree(item["tree_structure"]) for item in dump["tree_info"]]
    feature_count = len(report["model"]["features"])
    vectors = [
        np.zeros(feature_count, dtype=np.float64),
        np.ones(feature_count, dtype=np.float64),
        (np.arange(feature_count, dtype=np.float64) % 11) / 3.0,
    ]
    native = booster.predict(np.stack(vectors))
    exported = np.array([evaluate(trees, row) for row in vectors])
    if not np.allclose(native, exported, rtol=0.0, atol=1e-12):
        raise RuntimeError(f"Export parity failure: {np.max(np.abs(native - exported))}")
    calibration = float(report["model"]["validation_calibration_factor"])
    artifact = {
        "version": "stockout_lgbm_ratio_v1",
        "status": "experimental_offline_only",
        "calibration": calibration,
        "featureNames": report["model"]["features"],
        "trees": trees,
        "parity": [
            {"features": row.tolist(), "expectedRatio": float(value * calibration)}
            for row, value in zip(vectors, native, strict=True)
        ],
        "evaluatedScope": {
            "historyDays": 28,
            "horizonDays": 7,
            "availability": "known daily available/stockout status required",
            "dataset": report["dataset"]["name"],
            "trainSha256": report["dataset"]["train_sha256"],
            "evalSha256": report["dataset"]["eval_sha256"],
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.output} ({args.output.stat().st_size} bytes, {len(trees)} trees)")


if __name__ == "__main__":
    main()
