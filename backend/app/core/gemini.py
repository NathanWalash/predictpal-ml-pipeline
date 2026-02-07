"""
gemini.py — Google Gemini chat service (using google-genai SDK).

Handles prompt construction, context injection, and error handling
for the Free Tier (rate limits + safety filters).
"""

import os
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded client — only initialised when first called
_client = None


def _get_client():
    """Lazy-init the genai client so import doesn't fail without the key."""
    global _client
    if _client is not None:
        return _client

    try:
        from google import genai
    except ImportError:
        raise RuntimeError(
            "google-genai is not installed. "
            "Run: pip install google-genai"
        )

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Add it to backend/.env or export it as an environment variable."
        )

    _client = genai.Client(api_key=api_key)
    return _client


def _get_model_name() -> str:
    """Return the configured model name, defaulting to gemini-2.0-flash-lite."""
    return os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")


# ─── System prompt template ───────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are **Predict Pal**, an expert yet friendly Data Scientist embedded \
inside a no-code ML forecasting tool.

Rules:
- Keep answers concise (2-4 short paragraphs max).
- Use plain language a non-technical user can follow.
- When data context is provided, reference specific numbers/columns.
- Never fabricate data the user hasn't shared.
- Treat the latest PAGE CONTEXT as the source of truth for UI choices and selected values.
- If PAGE CONTEXT lists allowed option names, only use those names; do not invent or substitute alternatives.
- If a value is "not selected yet", acknowledge that explicitly instead of assuming.
- If asked something unrelated to data science, gently redirect.
- Use markdown formatting for readability (bold, bullets, etc.) but keep it light.
"""


def _build_prompt(
    message: str,
    page_context: str = "",
    report_data: Optional[str] = None,
    history: Optional[list[dict]] = None,
) -> str:
    """Assemble the full prompt sent to Gemini."""
    parts: list[str] = [SYSTEM_PROMPT]

    if page_context:
        parts.append(f"PAGE CONTEXT:\n{page_context}")

    if report_data:
        # Truncate very large payloads to stay within free-tier token limits
        truncated = report_data[:8000]
        if len(report_data) > 8000:
            truncated += "\n... [data truncated for brevity]"
        parts.append(f"DATA CONTEXT:\n{truncated}")

    # Append recent conversation history (last 10 turns to save tokens)
    if history:
        recent = history[-10:]
        convo_lines = []
        for turn in recent:
            role = "User" if turn.get("role") == "user" else "Assistant"
            convo_lines.append(f"{role}: {turn.get('content', '')}")
        parts.append("CONVERSATION HISTORY:\n" + "\n".join(convo_lines))

    parts.append(f"USER MESSAGE:\n{message}")

    return "\n\n".join(parts)


# ─── Public API ────────────────────────────────────────────────────────────────


async def generate_chat_response(
    message: str,
    page_context: str = "",
    report_data: Optional[str] = None,
    history: Optional[list[dict]] = None,
) -> dict:
    """
    Send a message to Gemini and return {"role": "assistant", "content": ...}.

    Handles Free Tier gotchas:
    - 429 Resource Exhausted  → friendly rate-limit message
    - Safety filter blocks    → polite refusal
    - Missing API key         → fallback stub
    """
    # ── Fallback when key isn't configured (keeps demo working) ──
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return _keyword_fallback(message)

    prompt = _build_prompt(message, page_context, report_data, history)

    try:
        from google.genai import types

        client = _get_client()
        model_name = _get_model_name()
        response = None
        # Retry once for transient provider overloads.
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        thinking_config=types.ThinkingConfig(
                            thinking_level="high" if attempt == 0 else "medium"
                        ),
                    ),
                )
                break
            except Exception as gen_err:
                err_text = str(gen_err).lower()
                is_overload = (
                    "503" in err_text
                    or "unavailable" in err_text
                    or "overloaded" in err_text
                    or "model is overloaded" in err_text
                )
                if attempt == 0 and is_overload:
                    await asyncio.sleep(1.0)
                    continue
                raise

        # Safety filter may block the response
        if not response or not response.text:
            return {
                "role": "assistant",
                "content": (
                    "I can't answer that specific question, "
                    "but I can help with your data! Try asking about "
                    "your columns, forecast results, or data cleaning."
                ),
            }

        return {
            "role": "assistant",
            "content": response.text,
        }

    except Exception as e:
        error_str = str(e).lower()
        error_type = type(e).__name__
        logger.error("Gemini API error [%s]: %s", error_type, str(e))

        if "429" in error_str or "resource exhausted" in error_str or "resourceexhausted" in error_str:
            return {
                "role": "assistant",
                "content": (
                    "⏳ I'm being rate-limited by the AI service. "
                    "Please wait about 30 seconds and try again!"
                ),
            }
        if (
            "503" in error_str
            or "unavailable" in error_str
            or "overloaded" in error_str
            or "model is overloaded" in error_str
        ):
            return {
                "role": "assistant",
                "content": (
                    "The AI provider is temporarily overloaded right now. "
                    "Please retry in 20-60 seconds."
                ),
            }
        if "safety" in error_str or "blocked" in error_str:
            return {
                "role": "assistant",
                "content": (
                    "I can't answer that specific question, "
                    "but I can help with your data and forecasts!"
                ),
            }
        # Surface the actual error so we can debug
        return {
            "role": "assistant",
            "content": (
                f"Something went wrong talking to the AI.\n\n"
                f"**Error ({error_type}):** {str(e)[:300]}"
            ),
        }


# ─── Keyword fallback (preserves existing behaviour when no key) ──────────────


def _keyword_fallback(message: str) -> dict:
    """Original keyword matcher — used when GEMINI_API_KEY is not set."""
    msg = message.lower()

    if any(w in msg for w in ["hello", "hi", "hey"]):
        reply = "Hey! I'm your Predict Pal. Upload a dataset and I'll help you explore patterns and build forecasts."
    elif "upload" in msg or "file" in msg:
        reply = "You can drag and drop a CSV or Excel file in Step 1. I'll automatically detect date columns and numeric targets for you."
    elif "driver" in msg or "feature" in msg:
        reply = "Drivers are external factors that might influence your data — like seasonality, holidays, or temperature."
    elif "accuracy" in msg or "improve" in msg:
        reply = "The multivariate model adds external drivers on top of the baseline. If a driver captures real variation, you'll see the green line track reality better."
    elif "forecast" in msg or "predict" in msg:
        reply = "Once you've selected your columns and drivers, hit 'Run Forecast'. I'll train two models — a baseline and a gradient-boosted one."
    else:
        reply = "I'm running in demo mode (no API key). Set GEMINI_API_KEY to unlock full AI responses!"

    return {"role": "assistant", "content": reply}

