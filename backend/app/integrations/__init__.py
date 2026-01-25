"""
External Service Integrations

This package contains HTTP clients and adapters for external services:
- Grocy API (inventory management)
- MQTT (Home Assistant - future)
- LLM services (OpenWebUI - future)
"""

from app.integrations.grocy import grocy_client

__all__ = ["grocy_client"]
