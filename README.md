# Nepal Data Explorer

## Backend setup

Create and activate a Python virtual environment, then install the backend dependencies:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Download your trained Hugging Face toxicity model required by Django moderation:

```bash
python ../scripts/download_toxicity_model.py
```

The script downloads `model.safetensors` from `SohamAdhikari/NepalDataExplorer-ToxicDetectorModel`, your public Colab-trained model, into `backend/analytics/ml/toxicity_model/`. The project’s `config.json`, `tokenizer.json`, and `tokenizer_config.json` remain tracked locally because the Hugging Face repository currently contains only the weight file and `.gitattributes`. The large weight is intentionally ignored by Git. To use another compatible model repository, set `TOXICITY_MODEL_ID` before running the same command. A Hugging Face token is not required for your public repository.

Run Django checks and tests:

```bash
python manage.py check
python manage.py test
```

The moderation service loads the downloaded model locally and does not use Ollama or an external API at request time.