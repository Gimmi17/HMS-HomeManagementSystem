"""
Application Configuration
Manages environment variables and application settings using Pydantic Settings.

This module loads configuration from .env file and provides type-safe access
to all application settings including database, JWT, and external service configs.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings are loaded from .env file or environment variables.
    Required settings will raise an error if not provided.
    Optional settings have default values.
    """

    # Database Configuration
    DATABASE_URL: str  # PostgreSQL connection string (required)
    # Format: postgresql://user:password@host:port/database

    # Security & Authentication
    SECRET_KEY: str  # JWT signing key (required, must be strong in production)
    JWT_EXPIRATION: int = 3600  # Access token expiration in seconds (default: 1 hour)
    REFRESH_TOKEN_EXPIRATION: int = 604800  # Refresh token expiration (default: 7 days)

    # External Services - Grocy Integration
    GROCY_URL: str = ""  # Grocy instance URL (optional, for inventory integration)
    GROCY_API_KEY: str = ""  # Grocy API key (optional)

    # MQTT Configuration (Future Phase 2)
    MQTT_BROKER: str = ""  # MQTT broker host (optional)
    MQTT_PORT: int = 1883  # MQTT broker port (default: 1883)
    MQTT_USER: str = ""  # MQTT username (optional)
    MQTT_PASSWORD: str = ""  # MQTT password (optional)

    # Application Settings
    API_VERSION: str = "v1"  # API version prefix
    PROJECT_NAME: str = "Meal Planner API"  # Project name for docs
    DEBUG: bool = False  # Debug mode (should be False in production)

    model_config = SettingsConfigDict(
        env_file=".env",  # Load from .env file
        env_file_encoding="utf-8",  # UTF-8 encoding
        case_sensitive=False  # Case-insensitive env vars
    )


# Global settings instance
# This singleton is imported throughout the application
settings = Settings()
