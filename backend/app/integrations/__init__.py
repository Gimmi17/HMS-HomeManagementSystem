"""
External Service Integrations

This package contains HTTP clients and adapters for external services:
- Grocy API (inventory management)
- LLM services (mlx-lm-server, LM Studio, Ollama, etc.)
- MQTT (Home Assistant - future)
"""

from app.integrations.grocy import grocy_client
from app.integrations.llm import (
    LLMConnection,
    LLMPurpose,
    LLMClient,
    LLMManager,
    get_llm_manager,
    get_ocr_client,
    get_chat_client,
)

__all__ = [
    "grocy_client",
    "LLMConnection",
    "LLMPurpose",
    "LLMClient",
    "LLMManager",
    "get_llm_manager",
    "get_ocr_client",
    "get_chat_client",
]
