"""Writing-canvas review — the learner draws/writes; the professor reads it.

The concept doc's path is: canvas strokes → rendered image → Claude vision. Here
we accept the rendered image (a data URL) and send it to a vision-capable backend
via the OpenAI-compatible image-message format (works with Ollama vision models,
OpenAI, etc.). When no vision model is configured it degrades gracefully rather
than failing — the rest of the lesson is unaffected.
"""

from __future__ import annotations

import logging

import httpx

from synapse_backend.config import get_settings

from .schemas import Lesson

logger = logging.getLogger(__name__)

# Prose, not JSON: small vision models (moondream/llava) read images well but
# follow JSON schemas poorly. Hosted vision models handle this prompt fine too.
WRITING_SYSTEM = (
    "You are a patient tutor looking at what a learner just wrote or drew for "
    "their lesson. In one or two short sentences, say what you see and give "
    "specific, encouraging feedback on correctness and form. Speak to the learner."
)

_DISABLED_MSG = (
    "Writing review needs a vision model. Set SYNAPSE_VISION_MODEL (e.g. a local "
    "'llama3.2-vision' or 'moondream' via Ollama, or a hosted vision model). For "
    "now, keep your strokes clear and evenly spaced."
)


async def check_writing(image_data_url: str, lesson: Lesson | None) -> dict:
    settings = get_settings()
    if not settings.vision_model:
        return {"feedback": _DISABLED_MSG, "annotation": None, "score": None}

    lesson_ctx = ""
    if lesson is not None:
        objs = "; ".join(lesson.objectives) or lesson.title
        lesson_ctx = f"Lesson: {lesson.title}. The learner is practising: {objs}. "

    url = settings.effective_vision_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.vision_model,
        "max_tokens": 300,
        "messages": [
            {"role": "system", "content": WRITING_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": lesson_ctx + "What did the learner write or draw?"},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
    }
    headers = {"Authorization": f"Bearer {settings.effective_vision_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            content = (resp.json()["choices"][0]["message"]["content"] or "").strip()
    except (httpx.HTTPError, KeyError, ValueError):
        logger.warning("writing-check vision call failed", exc_info=True)
        return {
            "feedback": "I couldn't read that clearly — try writing a little larger and we'll look again.",
            "annotation": None,
            "score": None,
        }

    return {
        "feedback": (content or "Nice work — keep going.")[:400],
        "annotation": None,  # vision models don't reliably emit SVG; optional on the client
        "score": None,
    }
