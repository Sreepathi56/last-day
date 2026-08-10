import json
import re
from abc import ABC, abstractmethod


def strip_markdown(text: str) -> str:
    """Remove markdown formatting symbols so replies render as clean plain text."""
    text = re.sub(r"```[a-zA-Z0-9_-]*\n?", "", text)
    text = re.sub(r"```", "", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s?", "", text, flags=re.MULTILINE)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    text = text.replace('"', "'")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class AIProvider(ABC):
    """Abstraction over the LLM so routes never call a provider directly."""

    @abstractmethod
    def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        """Return plain text completion for the given prompt."""

    def generate_json(self, prompt: str, system_prompt: str = "") -> dict:
        """Return a JSON object for the given prompt (defaults to parse of text)."""
        raw = self.generate_text(prompt, system_prompt)
        return self._extract_json(raw)

    @staticmethod
    def _extract_json(raw: str) -> dict:
        text = raw.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
        return json.loads(text)
