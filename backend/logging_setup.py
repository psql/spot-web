"""Logging setup with in-memory buffer for streaming."""
import logging
import sys
from collections import deque
from datetime import datetime
from threading import Lock
from typing import Optional


class InMemoryLogBuffer:
    """Thread-safe in-memory buffer for log entries."""

    def __init__(self, max_size: int = 1000):
        self.buffer = deque(maxlen=max_size)
        self.lock = Lock()
        self.listeners = []

    def append(self, record: dict):
        """Add a log record to the buffer."""
        with self.lock:
            self.buffer.append(record)
            # Notify all listeners
            for listener in self.listeners:
                try:
                    listener(record)
                except Exception:
                    pass

    def get_all(self) -> list[dict]:
        """Get all log records from the buffer."""
        with self.lock:
            return list(self.buffer)

    def add_listener(self, callback):
        """Add a listener that will be called for each new log entry."""
        with self.lock:
            self.listeners.append(callback)

    def remove_listener(self, callback):
        """Remove a listener."""
        with self.lock:
            if callback in self.listeners:
                self.listeners.remove(callback)


class BufferHandler(logging.Handler):
    """Logging handler that writes to in-memory buffer."""

    def __init__(self, buffer: InMemoryLogBuffer):
        super().__init__()
        self.buffer = buffer

    def emit(self, record: logging.LogRecord):
        """Emit a log record to the buffer."""
        try:
            log_entry = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "module": record.name,
                "message": record.getMessage(),
            }

            if record.exc_info:
                log_entry["exception"] = self.format(record)

            self.buffer.append(log_entry)
        except Exception:
            self.handleError(record)


# Global log buffer
log_buffer = InMemoryLogBuffer()


def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None):
    """
    Configure application logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path to write logs to
    """
    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Buffer handler for streaming
    buffer_handler = BufferHandler(log_buffer)
    buffer_handler.setFormatter(formatter)
    root_logger.addHandler(buffer_handler)

    # Optional file handler
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Set levels for noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    logging.info(f"Logging configured at {log_level} level")
