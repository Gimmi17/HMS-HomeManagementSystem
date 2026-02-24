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


class LLMType(str, Enum):
    """Supported LLM API types"""
    OPENAI = "openai"        # OpenAI-compatible (MLX, Ollama, LM Studio, vLLM)
    ANTHROPIC = "anthropic"  # Anthropic Claude API
    OSSGPT = "ossgpt"        # Open-source models (labeling per UI, usa protocollo OpenAI)
    DOCEXT = "docext"        # DocExt with Gradio API


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
    connection_type: LLMType = LLMType.OPENAI  # API type
    enabled: bool = True
    timeout: float = 30.0
    temperature: float = 0.3         # Default temperature
    max_tokens: int = 500            # Default max tokens

    # Optional fields for different providers
    api_key: Optional[str] = None    # For providers that need auth
    extra_headers: dict = field(default_factory=dict)

    # Thinking model settings
    is_thinking_model: bool = False
    thinking_budget_tokens: int = 10000

    # DocExt specific settings
    docext_auth_user: str = "admin"  # Gradio auth username
    docext_auth_pass: str = "admin"  # Gradio auth password

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON storage"""
        d = asdict(self)
        d['purpose'] = self.purpose.value
        d['connection_type'] = self.connection_type.value
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "LLMConnection":
        """Create from dictionary"""
        # Make a copy to avoid modifying the original
        data = dict(data)

        # Convert purpose string to enum
        if 'purpose' in data and isinstance(data['purpose'], str):
            data['purpose'] = LLMPurpose(data['purpose'])

        # Convert connection_type string to enum
        if 'connection_type' in data and isinstance(data['connection_type'], str):
            try:
                data['connection_type'] = LLMType(data['connection_type'])
            except ValueError:
                data['connection_type'] = LLMType.OPENAI
        elif 'connection_type' not in data:
            data['connection_type'] = LLMType.OPENAI

        # Handle extra_headers default
        if 'extra_headers' not in data:
            data['extra_headers'] = {}

        # Filter to only valid fields
        valid_fields = {
            'id', 'name', 'url', 'model', 'purpose', 'connection_type', 'enabled',
            'timeout', 'temperature', 'max_tokens', 'api_key', 'extra_headers',
            'is_thinking_model', 'thinking_budget_tokens',
            'docext_auth_user', 'docext_auth_pass'
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
                "max_tokens": max_tokens or self.connection.max_tokens,
            }

            # Thinking models (o1/o3) don't support temperature
            if not self.connection.is_thinking_model:
                payload["temperature"] = temperature or self.connection.temperature

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


class DocExtClient:
    """
    Client for DocExt Gradio API.

    DocExt provides document extraction using vision-language models via Gradio.
    API endpoint: /extract_information
    """

    def __init__(self, connection: LLMConnection):
        self.connection = connection
        self._client: Optional[httpx.AsyncClient] = None
        self._session_hash: Optional[str] = None

    @property
    def base_url(self) -> str:
        return self.connection.url.rstrip('/')

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            # DocExt uses basic auth
            auth = None
            if self.connection.docext_auth_user and self.connection.docext_auth_pass:
                auth = (self.connection.docext_auth_user, self.connection.docext_auth_pass)

            self._client = httpx.AsyncClient(
                timeout=self.connection.timeout,
                auth=auth
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def health_check(self) -> dict:
        """Check if DocExt server is available"""
        try:
            client = await self._get_client()

            # Try the Gradio config endpoint
            response = await client.get(f"{self.base_url}/config")

            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "ok",
                    "url": self.base_url,
                    "models": [self.connection.model] if self.connection.model else ["docext"],
                    "connection_name": self.connection.name,
                    "version": data.get("version", "unknown")
                }
            elif response.status_code == 401:
                return {"status": "error", "message": "Autenticazione fallita - verifica username/password"}
            return {"status": "error", "message": f"HTTP {response.status_code}"}

        except httpx.ConnectError:
            return {"status": "offline", "message": "Impossibile connettersi al server DocExt"}
        except Exception as e:
            logger.error(f"DocExt health check failed: {e}")
            return {"status": "error", "message": str(e)}

    async def extract_from_image(
        self,
        image_path: str,
        fields: Optional[list[dict]] = None
    ) -> dict:
        """
        Extract information from an image using DocExt.

        Args:
            image_path: Path to the image file
            fields: Optional list of fields to extract, e.g.:
                    [{"name": "product_name", "type": "field", "description": "Nome prodotto"}]
                    If not provided, uses default receipt extraction fields.

        Returns:
            Dict with extracted fields and tables
        """
        import base64
        import os

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Default fields for receipt extraction
        if fields is None:
            fields = [
                {"name": "store_name", "type": "field", "description": "Nome del negozio/supermercato"},
                {"name": "date", "type": "field", "description": "Data dello scontrino"},
                {"name": "total", "type": "field", "description": "Totale da pagare"},
                {"name": "products", "type": "table", "description": "Lista prodotti con nome, quantità, prezzo unitario, prezzo totale"},
            ]

        try:
            client = await self._get_client()

            # Read and encode image
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            image_b64 = base64.b64encode(image_bytes).decode('utf-8')

            # Determine mime type
            ext = os.path.splitext(image_path)[1].lower()
            mime_types = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}
            mime_type = mime_types.get(ext, 'image/jpeg')

            # Gradio API call format
            # First, upload the file
            import uuid
            session_hash = str(uuid.uuid4())

            # Call the predict endpoint
            payload = {
                "data": [
                    [{"path": image_path, "url": f"data:{mime_type};base64,{image_b64}"}],  # file_inputs
                    self.connection.model or "hosted_vllm/Qwen/Qwen2.5-VL-7B-Instruct-AWQ",  # model_name
                    {"headers": ["name", "type", "description"], "data": [[f["name"], f["type"], f["description"]] for f in fields]}  # fields_and_tables
                ],
                "session_hash": session_hash,
                "fn_index": 0  # extract_information function
            }

            response = await client.post(
                f"{self.base_url}/api/predict",
                json=payload,
                timeout=120.0  # Extraction can take time
            )

            if response.status_code != 200:
                logger.error(f"DocExt extraction failed: HTTP {response.status_code} - {response.text}")
                return {"error": f"HTTP {response.status_code}", "fields": {}, "tables": {}}

            data = response.json()

            # Parse Gradio response
            if "data" in data and len(data["data"]) >= 2:
                fields_result = data["data"][0]
                tables_result = data["data"][1]
                return {
                    "fields": fields_result,
                    "tables": tables_result,
                    "raw_response": data
                }

            return {"error": "Unexpected response format", "raw_response": data}

        except httpx.TimeoutException:
            logger.error("DocExt extraction timeout")
            return {"error": "Timeout durante estrazione"}
        except Exception as e:
            logger.error(f"DocExt extraction failed: {e}")
            return {"error": str(e)}

    async def extract_receipt_products(self, image_path: str) -> list[dict]:
        """
        Extract products from a receipt image.

        Returns list of products with name, quantity, unit_price, total_price
        """
        result = await self.extract_from_image(image_path)

        if "error" in result:
            logger.error(f"DocExt receipt extraction error: {result['error']}")
            return []

        products = []

        # Parse tables result for products
        tables = result.get("tables", {})
        if isinstance(tables, dict) and "data" in tables:
            for row in tables.get("data", []):
                if len(row) >= 4:
                    products.append({
                        "name": row[0] if row[0] else "",
                        "quantity": float(row[1]) if row[1] else 1.0,
                        "unit_price": float(row[2]) if row[2] else None,
                        "total_price": float(row[3]) if row[3] else None
                    })

        return products


class AnthropicClient:
    """
    Client for Anthropic Claude API.

    Uses the Messages API with support for extended thinking.
    """

    def __init__(self, connection: LLMConnection):
        self.connection = connection
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def base_url(self) -> str:
        return self.connection.url.rstrip('/')

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {
                "x-api-key": self.connection.api_key or "",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            self._client = httpx.AsyncClient(
                timeout=self.connection.timeout,
                headers=headers,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def health_check(self) -> dict:
        """Check if Anthropic API is reachable by sending a minimal message."""
        try:
            client = await self._get_client()

            payload = {
                "model": self.connection.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Rispondi solo: OK"}],
            }

            response = await client.post(
                f"{self.base_url}/v1/messages",
                json=payload,
            )

            if response.status_code == 200:
                return {
                    "status": "ok",
                    "url": self.base_url,
                    "models": [self.connection.model],
                    "connection_name": self.connection.name,
                }
            elif response.status_code == 401:
                return {"status": "error", "message": "API key non valida"}
            return {"status": "error", "message": f"HTTP {response.status_code}: {response.text[:200]}"}

        except httpx.ConnectError:
            return {"status": "offline", "message": "Impossibile connettersi all'API Anthropic"}
        except Exception as e:
            logger.error(f"Anthropic health check failed: {e}")
            return {"status": "error", "message": str(e)}

    async def chat_completion(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Send a chat completion request to Anthropic Messages API.

        Extracts system message from messages array into top-level field.
        Supports extended thinking mode.
        """
        if not self.connection.enabled:
            logger.info(f"LLM connection '{self.connection.name}' is disabled")
            return None

        try:
            client = await self._get_client()

            # Extract system message
            system_text = None
            api_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_text = msg["content"]
                else:
                    api_messages.append(msg)

            payload: dict = {
                "model": self.connection.model,
                "max_tokens": max_tokens or self.connection.max_tokens,
                "messages": api_messages,
            }

            if system_text:
                payload["system"] = system_text

            if self.connection.is_thinking_model:
                # Extended thinking: add thinking block, don't send temperature
                payload["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": self.connection.thinking_budget_tokens,
                }
            else:
                payload["temperature"] = temperature or self.connection.temperature

            response = await client.post(
                f"{self.base_url}/v1/messages",
                json=payload,
            )

            if response.status_code != 200:
                logger.error(f"Anthropic request failed: HTTP {response.status_code} - {response.text[:500]}")
                return None

            data = response.json()
            # Filter content blocks for type == "text" (ignore thinking blocks)
            content_blocks = data.get("content", [])
            text_parts = [b["text"] for b in content_blocks if b.get("type") == "text"]
            return "\n".join(text_parts) if text_parts else None

        except httpx.TimeoutException:
            logger.error(f"Anthropic request timeout after {self.connection.timeout}s")
            return None
        except Exception as e:
            logger.error(f"Anthropic chat completion failed: {e}")
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

    def get_client(self, connection_id: str) -> Optional[LLMClient | DocExtClient | AnthropicClient]:
        """Get or create a client for a specific connection"""
        conn = self._connections.get(connection_id)
        if not conn:
            return None

        if connection_id not in self._clients:
            # Create appropriate client based on connection type
            if conn.connection_type == LLMType.DOCEXT:
                self._clients[connection_id] = DocExtClient(conn)
            elif conn.connection_type == LLMType.ANTHROPIC:
                self._clients[connection_id] = AnthropicClient(conn)
            else:  # OPENAI and OSSGPT use OpenAI-compatible protocol
                self._clients[connection_id] = LLMClient(conn)

        return self._clients[connection_id]

    def get_docext_client(self, connection_id: str) -> Optional[DocExtClient]:
        """Get a DocExt client specifically"""
        client = self.get_client(connection_id)
        if isinstance(client, DocExtClient):
            return client
        return None

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


async def test_connection(
    url: str,
    model: str = "default",
    connection_type: str = "openai",
    docext_auth_user: str = "admin",
    docext_auth_pass: str = "admin",
    api_key: Optional[str] = None,
) -> dict:
    """Test a new connection before saving"""
    conn = LLMConnection(
        id="test",
        name="Test",
        url=url,
        model=model,
        connection_type=LLMType(connection_type) if connection_type else LLMType.OPENAI,
        docext_auth_user=docext_auth_user,
        docext_auth_pass=docext_auth_pass,
        api_key=api_key,
    )

    if conn.connection_type == LLMType.DOCEXT:
        client = DocExtClient(conn)
        try:
            health = await client.health_check()
            if health.get("status") == "ok":
                health["test_response"] = "DocExt connesso"
            return health
        finally:
            await client.close()
    elif conn.connection_type == LLMType.ANTHROPIC:
        client = AnthropicClient(conn)
        try:
            health = await client.health_check()
            if health.get("status") == "ok":
                # health_check already sends a test message for Anthropic
                health["test_response"] = "Anthropic connesso"
            return health
        finally:
            await client.close()
    else:  # OPENAI and OSSGPT
        client = LLMClient(conn)
        try:
            health = await client.health_check()
            if health.get("status") == "ok":
                response = await client.chat_completion(
                    messages=[{"role": "user", "content": "Rispondi solo: OK"}],
                    max_tokens=10
                )
                health["test_response"] = response
            return health
        finally:
            await client.close()
