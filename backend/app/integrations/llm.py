"""
LLM Integration Module - Multi-provider, multi-purpose LLM connections.

Supports multiple LLM configurations for different use cases:
- ocr: Receipt text interpretation and matching
- chat: General conversation (future)
- suggestions: Recipe/meal suggestions (future)

Compatible with OpenAI-compatible APIs (mlx-lm-server, LM Studio, Ollama, etc.)
"""

import logging
from typing import Optional, Literal
from dataclasses import dataclass, field, asdict
from enum import Enum

import httpx

logger = logging.getLogger(__name__)


class LLMPurpose(str, Enum):
    """Supported LLM use cases"""
    OCR = "ocr"              # Receipt OCR interpretation
    CHAT = "chat"            # General chatting (future)
    SUGGESTIONS = "suggestions"  # Recipe/meal suggestions (future)
    GENERAL = "general"      # Default/fallback


@dataclass
class LLMConnection:
    """
    Configuration for a single LLM connection.

    Stored in house settings or dedicated table.
    """
    id: str                          # Unique identifier
    name: str                        # Display name (e.g., "MLX Locale", "Ollama Server")
    url: str                         # Base URL (e.g., "http://localhost:8080")
    model: str = "default"           # Model name/id
    purpose: LLMPurpose = LLMPurpose.GENERAL  # What this connection is used for
    enabled: bool = True
    timeout: float = 30.0
    temperature: float = 0.3         # Default temperature
    max_tokens: int = 500            # Default max tokens

    # Optional fields for different providers
    api_key: Optional[str] = None    # For providers that need auth
    extra_headers: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON storage"""
        d = asdict(self)
        d['purpose'] = self.purpose.value
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "LLMConnection":
        """Create from dictionary"""
        # Make a copy to avoid modifying the original
        data = dict(data)

        # Convert purpose string to enum
        if 'purpose' in data and isinstance(data['purpose'], str):
            data['purpose'] = LLMPurpose(data['purpose'])

        # Handle extra_headers default
        if 'extra_headers' not in data:
            data['extra_headers'] = {}

        # Filter to only valid fields
        valid_fields = {
            'id', 'name', 'url', 'model', 'purpose', 'enabled',
            'timeout', 'temperature', 'max_tokens', 'api_key', 'extra_headers'
        }
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}

        return cls(**filtered_data)


class LLMClient:
    """
    Client for OpenAI-compatible LLM APIs.

    Supports mlx-lm-server, LM Studio, Ollama, and any OpenAI-compatible endpoint.
    """

    def __init__(self, connection: LLMConnection):
        self.connection = connection
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def base_url(self) -> str:
        return self.connection.url.rstrip('/')

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = dict(self.connection.extra_headers)
            if self.connection.api_key:
                headers["Authorization"] = f"Bearer {self.connection.api_key}"
            self._client = httpx.AsyncClient(
                timeout=self.connection.timeout,
                headers=headers
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def health_check(self) -> dict:
        """Check if LLM server is available and get model info"""
        try:
            client = await self._get_client()

            # Try /v1/models endpoint (OpenAI-compatible)
            response = await client.get(f"{self.base_url}/v1/models")

            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])
                return {
                    "status": "ok",
                    "url": self.base_url,
                    "models": [m.get("id", "unknown") for m in models],
                    "connection_name": self.connection.name
                }
            return {"status": "error", "message": f"HTTP {response.status_code}"}

        except httpx.ConnectError:
            return {"status": "offline", "message": "Cannot connect to LLM server"}
        except Exception as e:
            logger.error(f"LLM health check failed: {e}")
            return {"status": "error", "message": str(e)}

    async def chat_completion(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Optional[str]:
        """
        Send a chat completion request to the LLM.

        Args:
            messages: List of {"role": "user/assistant/system", "content": "..."}
            temperature: Sampling temperature (uses connection default if not specified)
            max_tokens: Maximum response tokens (uses connection default if not specified)

        Returns:
            The assistant's response text, or None on error
        """
        if not self.connection.enabled:
            logger.info(f"LLM connection '{self.connection.name}' is disabled")
            return None

        try:
            client = await self._get_client()

            payload = {
                "model": self.connection.model,
                "messages": messages,
                "temperature": temperature or self.connection.temperature,
                "max_tokens": max_tokens or self.connection.max_tokens,
            }

            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload
            )

            if response.status_code != 200:
                logger.error(f"LLM request failed: HTTP {response.status_code} - {response.text}")
                return None

            data = response.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content")
            return None

        except httpx.TimeoutException:
            logger.error(f"LLM request timeout after {self.connection.timeout}s")
            return None
        except Exception as e:
            logger.error(f"LLM chat completion failed: {e}")
            return None


# =============================================================================
# LLM Manager - Handles multiple connections
# =============================================================================

class LLMManager:
    """
    Manages multiple LLM connections and routes requests to the appropriate one.
    """

    def __init__(self):
        self._connections: dict[str, LLMConnection] = {}
        self._clients: dict[str, LLMClient] = {}

    def add_connection(self, connection: LLMConnection):
        """Add or update a connection"""
        self._connections[connection.id] = connection
        # Invalidate cached client
        if connection.id in self._clients:
            del self._clients[connection.id]

    def remove_connection(self, connection_id: str):
        """Remove a connection"""
        self._connections.pop(connection_id, None)
        self._clients.pop(connection_id, None)

    def get_connection(self, connection_id: str) -> Optional[LLMConnection]:
        """Get a specific connection by ID"""
        return self._connections.get(connection_id)

    def get_connections_by_purpose(self, purpose: LLMPurpose) -> list[LLMConnection]:
        """Get all connections for a specific purpose"""
        return [
            conn for conn in self._connections.values()
            if conn.purpose == purpose and conn.enabled
        ]

    def get_all_connections(self) -> list[LLMConnection]:
        """Get all configured connections"""
        return list(self._connections.values())

    def get_client(self, connection_id: str) -> Optional[LLMClient]:
        """Get or create a client for a specific connection"""
        conn = self._connections.get(connection_id)
        if not conn:
            return None

        if connection_id not in self._clients:
            self._clients[connection_id] = LLMClient(conn)

        return self._clients[connection_id]

    def get_client_for_purpose(self, purpose: LLMPurpose) -> Optional[LLMClient]:
        """Get the first enabled client for a specific purpose"""
        connections = self.get_connections_by_purpose(purpose)
        if not connections:
            # Fallback to GENERAL purpose
            connections = self.get_connections_by_purpose(LLMPurpose.GENERAL)

        if connections:
            return self.get_client(connections[0].id)
        return None

    def load_from_settings(self, settings: dict):
        """Load connections from house settings or config"""
        llm_configs = settings.get("llm_connections", [])
        for config in llm_configs:
            try:
                conn = LLMConnection.from_dict(config)
                self.add_connection(conn)
            except Exception as e:
                logger.warning(f"Failed to load LLM connection: {e}")

    def to_settings(self) -> list[dict]:
        """Export connections to settings format"""
        return [conn.to_dict() for conn in self._connections.values()]

    async def close_all(self):
        """Close all client connections"""
        for client in self._clients.values():
            await client.close()
        self._clients.clear()


# =============================================================================
# Global Manager Instance
# =============================================================================

_manager: Optional[LLMManager] = None


def get_llm_manager() -> LLMManager:
    """Get the global LLM manager instance"""
    global _manager
    if _manager is None:
        _manager = LLMManager()
    return _manager


# =============================================================================
# Convenience Functions for specific use cases
# =============================================================================

async def get_ocr_client() -> Optional[LLMClient]:
    """Get the LLM client configured for OCR tasks"""
    manager = get_llm_manager()
    return manager.get_client_for_purpose(LLMPurpose.OCR)


async def get_chat_client() -> Optional[LLMClient]:
    """Get the LLM client configured for chat tasks (future)"""
    manager = get_llm_manager()
    return manager.get_client_for_purpose(LLMPurpose.CHAT)


async def check_connection_health(connection_id: str) -> dict:
    """Check health of a specific connection"""
    manager = get_llm_manager()
    client = manager.get_client(connection_id)
    if not client:
        return {"status": "error", "message": "Connection not found"}
    return await client.health_check()


async def test_connection(url: str, model: str = "default") -> dict:
    """Test a new connection before saving"""
    conn = LLMConnection(
        id="test",
        name="Test",
        url=url,
        model=model
    )
    client = LLMClient(conn)
    try:
        health = await client.health_check()
        if health.get("status") == "ok":
            # Try a simple completion
            response = await client.chat_completion(
                messages=[{"role": "user", "content": "Rispondi solo: OK"}],
                max_tokens=10
            )
            health["test_response"] = response
        return health
    finally:
        await client.close()
