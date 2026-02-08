"""FastAPI server for Spot Web Controller."""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.config import config
from backend.logging_setup import setup_logging, log_buffer
from backend.spot_bridge import SpotBridge

# Setup logging
setup_logging(log_level=config.LOG_LEVEL, log_file="spot_web.log")
logger = logging.getLogger(__name__)

# Global Spot bridge instance
spot_bridge: Optional[SpotBridge] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global spot_bridge

    # Startup
    logger.info("Starting Spot Web Controller")
    logger.info(f"Config: {config.to_dict(include_secrets=False)}")

    # Validate configuration
    is_valid, error_msg = config.validate()
    if not is_valid:
        logger.error(f"Configuration error: {error_msg}")
        logger.warning("Server starting but connection will fail without valid config")

    # Create bridge instance
    spot_bridge = SpotBridge(
        hostname=config.SPOT_HOST,
        username=config.SPOT_USER,
        password=config.SPOT_PASS
    )

    yield

    # Shutdown
    logger.info("Shutting down Spot Web Controller")
    if spot_bridge and spot_bridge.connected:
        logger.info("Disconnecting from Spot...")
        spot_bridge.disconnect()


# Create FastAPI app
app = FastAPI(
    title="Spot Web Controller",
    description="Local web controller for Boston Dynamics Spot",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class VelocityCommand(BaseModel):
    vx: float
    vy: float
    yaw: float
    body_height: float = 0.0
    body_roll: float = 0.0
    body_pitch: float = 0.0
    body_yaw: float = 0.0
    locomotion_hint: Optional[int] = None


# Health and info endpoints
@app.get("/api/health")
async def health():
    """Server health check."""
    return {
        "ok": True,
        "data": {
            "server": "running",
            "config": config.to_dict(include_secrets=False),
            "connected": spot_bridge.connected if spot_bridge else False,
        }
    }


# Connection endpoints
@app.post("/api/connect")
async def connect():
    """Connect to Spot robot."""
    if not spot_bridge:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": {"message": "Bridge not initialized"}}
        )

    try:
        result = spot_bridge.connect()
        return result
    except Exception as e:
        logger.error(f"Error in connect endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/disconnect")
async def disconnect():
    """Disconnect from Spot robot."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.disconnect()
        return result
    except Exception as e:
        logger.error(f"Error in disconnect endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.get("/api/status")
async def get_status():
    """Get current robot status."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.get_status()
        return result
    except Exception as e:
        logger.error(f"Error in status endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


# Power control endpoints
@app.post("/api/power/on")
async def power_on():
    """Power on robot motors."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.power_on()
        return result
    except Exception as e:
        logger.error(f"Error in power_on endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/power/off")
async def power_off():
    """Power off robot motors."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.power_off()
        return result
    except Exception as e:
        logger.error(f"Error in power_off endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


# Command endpoints
@app.post("/api/command/stand")
async def command_stand():
    """Command robot to stand."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.stand()
        return result
    except Exception as e:
        logger.error(f"Error in stand endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/command/sit")
async def command_sit():
    """Command robot to sit."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.sit()
        return result
    except Exception as e:
        logger.error(f"Error in sit endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/command/stop")
async def command_stop():
    """Emergency stop command."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.stop()
        return result
    except Exception as e:
        logger.error(f"Error in stop endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/command/velocity")
async def command_velocity(cmd: VelocityCommand):
    """Send velocity command with optional gait and body pose customization."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.send_velocity(
            cmd.vx, cmd.vy, cmd.yaw,
            cmd.body_height, cmd.body_roll, cmd.body_pitch, cmd.body_yaw,
            cmd.locomotion_hint
        )
        return result
    except Exception as e:
        logger.error(f"Error in velocity endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


class BodyPoseCommand(BaseModel):
    height: float
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0


@app.post("/api/command/body-pose")
async def command_body_pose(cmd: BodyPoseCommand):
    """Set body pose (height and orientation)."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.set_body_pose(cmd.height, cmd.roll, cmd.pitch, cmd.yaw)
        return result
    except Exception as e:
        logger.error(f"Error in body_pose endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


# E-Stop endpoints
@app.post("/api/estop/stop")
async def estop_stop():
    """Trigger E-Stop."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.estop_stop()
        return result
    except Exception as e:
        logger.error(f"Error in estop_stop endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.post("/api/estop/release")
async def estop_release():
    """Release E-Stop."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.estop_release()
        return result
    except Exception as e:
        logger.error(f"Error in estop_release endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


# Diagnostics endpoints
@app.get("/api/diagnose")
async def diagnose():
    """Run diagnostics."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.diagnose()
        return result
    except Exception as e:
        logger.error(f"Error in diagnose endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.get("/api/test-connection")
async def test_connection():
    """Test connection to Spot with detailed diagnostics."""
    if not spot_bridge:
        return {"ok": False, "error": {"message": "Bridge not initialized"}}

    try:
        result = spot_bridge.test_connection()
        return result
    except Exception as e:
        logger.error(f"Error in test_connection endpoint: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


@app.get("/api/logs/download")
async def download_logs():
    """Download log file."""
    try:
        with open("spot_web.log", "r") as f:
            content = f.read()
        return JSONResponse(
            content={"ok": True, "data": {"logs": content}},
            headers={
                "Content-Disposition": "attachment; filename=spot_web.log"
            }
        )
    except FileNotFoundError:
        return {"ok": False, "error": {"message": "Log file not found"}}
    except Exception as e:
        logger.error(f"Error downloading logs: {e}", exc_info=True)
        return {
            "ok": False,
            "error": {
                "error_type": e.__class__.__name__,
                "message": str(e),
                "suggested_fix": "Check logs for details"
            }
        }


# WebSocket endpoints
@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry."""
    await websocket.accept()
    logger.info("Telemetry WebSocket connected")

    try:
        while True:
            if spot_bridge:
                status = spot_bridge.get_status()
                await websocket.send_json(status)
            else:
                await websocket.send_json({
                    "ok": False,
                    "error": {"message": "Bridge not initialized"}
                })
            await asyncio.sleep(1.0)  # 1Hz update rate (reduced to avoid rate limiting)
    except WebSocketDisconnect:
        logger.info("Telemetry WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in telemetry WebSocket: {e}", exc_info=True)


@app.websocket("/ws/logs")
async def logs_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time log streaming."""
    await websocket.accept()
    logger.info("Logs WebSocket connected")

    # Create queue for this connection
    log_queue = asyncio.Queue()

    def log_callback(record):
        """Callback for new log entries."""
        try:
            asyncio.create_task(log_queue.put(record))
        except Exception:
            pass

    # Add listener
    log_buffer.add_listener(log_callback)

    try:
        # Send existing logs
        for record in log_buffer.get_all():
            await websocket.send_json(record)

        # Stream new logs
        while True:
            record = await log_queue.get()
            await websocket.send_json(record)
    except WebSocketDisconnect:
        logger.info("Logs WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in logs WebSocket: {e}", exc_info=True)
    finally:
        log_buffer.remove_listener(log_callback)


# Mount static files (must be last)
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app:app",
        host=config.BIND_HOST,
        port=config.BIND_PORT,
        reload=True
    )
