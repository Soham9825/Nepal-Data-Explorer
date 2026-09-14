#!/usr/bin/env python3
"""Download the local Hugging Face model required by Django moderation."""

import os
from pathlib import Path

DEFAULT_REPOSITORY_ID = "SohamAdhikari/NepalDataExplorer-ToxicDetectorModel"
REPOSITORY_ID = os.getenv("TOXICITY_MODEL_ID", DEFAULT_REPOSITORY_ID).strip()
PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIRECTORY = PROJECT_ROOT / "backend" / "analytics" / "ml" / "toxicity_model"
REQUIRED_FILES = {
    "model.safetensors",
}
PROJECT_METADATA_FILES = {
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
}


def main() -> None:
    from huggingface_hub import snapshot_download

    MODEL_DIRECTORY.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=REPOSITORY_ID,
        local_dir=MODEL_DIRECTORY,
        allow_patterns=["model.safetensors"],
    )
    missing = sorted(name for name in REQUIRED_FILES if not (MODEL_DIRECTORY / name).is_file())
    if missing:
        raise RuntimeError(f"Model download completed but required files are missing: {', '.join(missing)}")
    missing_metadata = sorted(name for name in PROJECT_METADATA_FILES if not (MODEL_DIRECTORY / name).is_file())
    if missing_metadata:
        raise RuntimeError(
            "The model weight downloaded, but project metadata/tokenizer files are missing: "
            + ", ".join(missing_metadata)
        )
    print(f"Downloaded {REPOSITORY_ID} to {MODEL_DIRECTORY}")


if __name__ == "__main__":
    main()