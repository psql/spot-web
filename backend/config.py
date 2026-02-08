"""Configuration management for Spot Web Controller."""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    def __init__(self):
        # Required variables
        self.SPOT_HOST: str = os.getenv("SPOT_HOST", "")
        self.SPOT_USER: str = os.getenv("SPOT_USER", "")
        self.SPOT_PASS: str = os.getenv("SPOT_PASS", "")

        # Optional variables with defaults
        self.BIND_HOST: str = os.getenv("BIND_HOST", "0.0.0.0")
        self.BIND_PORT: int = int(os.getenv("BIND_PORT", "8080"))
        self.LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

    def validate(self) -> tuple[bool, Optional[str]]:
        """
        Validate required configuration.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.SPOT_HOST:
            return False, "SPOT_HOST environment variable is required"
        if not self.SPOT_USER:
            return False, "SPOT_USER environment variable is required"
        if not self.SPOT_PASS:
            return False, "SPOT_PASS environment variable is required"

        # Validate log level
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.LOG_LEVEL not in valid_levels:
            return False, f"LOG_LEVEL must be one of {valid_levels}"

        return True, None

    def to_dict(self, include_secrets: bool = False) -> dict:
        """
        Convert config to dictionary.

        Args:
            include_secrets: Whether to include sensitive values

        Returns:
            Dictionary representation of config
        """
        return {
            "SPOT_HOST": self.SPOT_HOST,
            "SPOT_USER": self.SPOT_USER if include_secrets else "***",
            "SPOT_PASS": "***" if self.SPOT_PASS else "",
            "BIND_HOST": self.BIND_HOST,
            "BIND_PORT": self.BIND_PORT,
            "LOG_LEVEL": self.LOG_LEVEL,
        }


# Singleton config instance
config = Config()
