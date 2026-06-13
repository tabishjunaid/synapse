"""make_backend() dispatch — verifies each brain builds the right backend with
the right provider quirks, without any network calls."""

import pytest

from synapse_backend.brain import teacher
from synapse_backend.brain.backends import OpenAICompatBackend
from synapse_backend.config import Settings


def _patch(monkeypatch, **overrides):
    settings = Settings(**overrides)
    monkeypatch.setattr(teacher, "get_settings", lambda: settings)
    return settings


def test_local_is_default(monkeypatch):
    _patch(monkeypatch)
    backend = teacher.make_backend()
    assert isinstance(backend, OpenAICompatBackend)
    assert backend._url == "http://localhost:11434/v1/chat/completions"
    assert backend._max_tokens_field == "max_tokens"
    assert backend._extra_body == {}


def test_deepseek_backend(monkeypatch):
    _patch(monkeypatch, brain="deepseek", deepseek_api_key="sk-test")
    backend = teacher.make_backend()
    assert isinstance(backend, OpenAICompatBackend)
    assert backend._url == "https://api.deepseek.com/v1/chat/completions"
    assert backend._headers["Authorization"] == "Bearer sk-test"
    assert backend._max_tokens_field == "max_tokens"


def test_openai_backend_uses_completion_tokens_and_minimal_reasoning(monkeypatch):
    _patch(monkeypatch, brain="openai", openai_api_key="sk-test")
    backend = teacher.make_backend()
    assert isinstance(backend, OpenAICompatBackend)
    assert backend._url == "https://api.openai.com/v1/chat/completions"
    assert backend._max_tokens_field == "max_completion_tokens"
    assert backend._extra_body == {"reasoning_effort": "minimal"}


def test_hosted_backend_without_key_fails_fast(monkeypatch):
    _patch(monkeypatch, brain="deepseek")  # no key
    with pytest.raises(RuntimeError, match="needs an API key"):
        teacher.make_backend()


def test_http_timeout_flows_into_client(monkeypatch):
    _patch(monkeypatch, http_timeout=420.0)
    backend = teacher.make_backend()
    # httpx stores the read timeout on the client's Timeout config.
    assert backend._client.timeout.read == 420.0
    assert backend._client.timeout.connect == 5.0


def test_active_model_tracks_brain():
    assert Settings(brain="local").active_model == "llama3.2:3b"
    assert Settings(brain="deepseek").active_model == "deepseek-chat"
    assert Settings(brain="openai").active_model == "gpt-5-mini"
    assert Settings(brain="anthropic").active_model == "claude-haiku-4-5"
