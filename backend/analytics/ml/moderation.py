from __future__ import annotations

import re
import threading
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


DEFAULT_PROFANITY_WORDS = {
    "randi", "muji", "machikne", "khatey", "besya", "bitch", "bastard",
    "fuck", "fucker", "motherfucker", "asshole", "idiot", "moron",
}
DEFAULT_PROFANITY_PHRASES = {"randi ko ban", "machikne ko ban"}
LEET_MAP = str.maketrans({"@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "$": "s", "5": "s", "7": "t"})
TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)


@dataclass(frozen=True)
class ModerationResult:
    allowed: bool
    status: str
    toxicity_label: str
    toxicity_confidence: float
    profanity_detected: bool
    message: str

    def as_dict(self) -> dict[str, object]:
        return self.__dict__.copy()


def _normalize_token(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold().translate(LEET_MAP)
    value = "".join(char for char in unicodedata.normalize("NFKD", value) if not unicodedata.combining(char))
    return re.sub(r"(.)\1+", r"\1", value)


def _normalized_tokens(message: str) -> list[str]:
    return [_normalize_token(token) for token in TOKEN_RE.findall(message)]


def find_profanity(message: str) -> bool:
    words = {_normalize_token(word) for word in getattr(settings, "PROFANITY_WORDS", DEFAULT_PROFANITY_WORDS)}
    phrases = [[_normalize_token(part) for part in phrase.split()] for phrase in getattr(settings, "PROFANITY_PHRASES", DEFAULT_PROFANITY_PHRASES)]
    tokens = _normalized_tokens(message)
    if any(token in words for token in tokens):
        return True
    normalized_message = unicodedata.normalize("NFKC", message).casefold().translate(LEET_MAP)
    for word in words:
        pattern = r"(?<!\w)" + r"[^\w]*".join(re.escape(char) + r"+" for char in word) + r"(?!\w)"
        if re.search(pattern, normalized_message, re.UNICODE):
            return True
    return any(tokens[index:index + len(phrase)] == phrase for phrase in phrases for index in range(len(tokens)))


class ToxicityModel:
    _instance: ToxicityModel | None = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        model_path = Path(getattr(settings, "TOXICITY_MODEL_PATH", Path(settings.BASE_DIR) / "analytics/ml/toxicity_model"))
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path, local_files_only=True)
        self.torch = torch
        self.model.eval()

    @classmethod
    def get(cls) -> ToxicityModel:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def classify(self, message: str) -> tuple[str, float]:
        encoded = self.tokenizer(message, return_tensors="pt", truncation=True, max_length=512)
        with self.torch.inference_mode():
            probabilities = self.torch.softmax(self.model(**encoded).logits, dim=-1)[0]
        confidence, label_id = self.torch.max(probabilities, dim=-1)
        label = self.model.config.id2label.get(int(label_id), str(int(label_id)))
        return str(label), float(confidence)


def moderate_message(message: str) -> ModerationResult:
    profanity_detected = find_profanity(message)
    if profanity_detected:
        return ModerationResult(False, "blocked", "", 0.0, True, "Your message contains abusive language and cannot be sent.")
    label, confidence = ToxicityModel.get().classify(message)
    normalized_label = label.casefold().replace("_", "-")
    toxic_labels = {value.casefold().replace("_", "-") for value in getattr(settings, "TOXICITY_LABELS", {"toxic", "toxicity"})}
    is_toxic_label = normalized_label in toxic_labels or any(term in normalized_label for term in ("toxic", "obscene", "insult", "threat", "hate"))
    block_threshold = float(getattr(settings, "TOXICITY_BLOCK_THRESHOLD", 0.85))
    warning_threshold = float(getattr(settings, "TOXICITY_WARNING_THRESHOLD", 0.50))

    if is_toxic_label and confidence >= block_threshold:
        return ModerationResult(False, "blocked", label, confidence, False, "Your message was blocked because it appears toxic.")
    if is_toxic_label and confidence >= warning_threshold:
        return ModerationResult(True, "warning", label, confidence, False, "Please review your message before sending it.")
    return ModerationResult(True, "allowed", label, confidence, False, "Message accepted.")