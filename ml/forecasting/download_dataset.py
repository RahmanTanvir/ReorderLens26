from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path


FILES = {
    "train.parquet": (
        "https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/resolve/main/data/train.parquet?download=true",
        "6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d",
    ),
    "eval.parquet": (
        "https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/resolve/main/data/eval.parquet?download=true",
        "1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e",
    ),
}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Download the attributed FreshRetailNet-50K v1.0 benchmark files.")
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts/ml-evaluation/data"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in FILES.items():
        destination = args.output_dir / name
        if destination.exists() and digest(destination) == expected:
            print(f"verified {destination}")
            continue
        temporary = destination.with_suffix(destination.suffix + ".partial")
        try:
            urllib.request.urlretrieve(url, temporary)
            actual = digest(temporary)
            if actual != expected:
                raise RuntimeError(f"checksum mismatch for {name}: {actual}")
            temporary.replace(destination)
            print(f"downloaded and verified {destination}")
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
