import logging

from app.ai.base import AIProvider, strip_markdown
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """Real Gemini implementation via google-generativeai.

    When no GEMINI_API_KEY is configured the provider returns clearly-marked
    offline responses so the full request cycle can still be exercised.
    """

    _genai = None

    def __init__(self) -> None:
        self._available = False
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set; running in offline demo mode.")
            return
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._model = genai.GenerativeModel(settings.MODEL)
            self._available = True
            GeminiProvider._genai = genai
        except Exception as exc:  # pragma: no cover - depends on env
            logger.exception("Failed to initialise Gemini: %s", exc)
            self._available = False

    def _generate(self, prompt: str, system_prompt: str) -> str:
        full = f"{system_prompt}\n\n---\n\n{prompt}" if system_prompt else prompt
        response = self._model.generate_content(full)
        return response.text or ""

    def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        if not self._available:
            return self._offline_response(prompt)
        try:
            return strip_markdown(self._generate(prompt, system_prompt))
        except Exception as exc:  # network/rate-limit errors
            logger.exception("Gemini call failed")
            return f"[AI service error: {exc}] Please try again."

    def generate_json(self, prompt: str, system_prompt: str = "") -> dict:
        if not self._available:
            return self._offline_json()
        try:
            raw = self._generate(prompt, system_prompt)
            return self._extract_json(raw)
        except Exception as exc:
            logger.exception("Gemini JSON call failed")
            return {"error": f"AI service error: {exc}", "questions": []}

    @staticmethod
    def _offline_response(prompt: str) -> str:
        return (
            "OFFLINE DEMO MODE: GEMINI_API_KEY is not set, so no live AI answer "
            "was generated.\n\nYour question was:\n" + prompt
        )

    @staticmethod
    def _offline_json() -> dict:
        return {
            "error": "OFFLINE DEMO MODE: GEMINI_API_KEY is not set.",
            "topic": "offline",
            "questions": [],
        }


def get_provider() -> AIProvider:
    return GeminiProvider()
