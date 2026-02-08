"""Spot SDK bridge with safety features and diagnostics."""
import logging
import socket
import threading
import time
from typing import Optional, Dict, Any

import bosdyn.client
import bosdyn.client.util
from bosdyn.client import Robot, RpcError
from bosdyn.client.estop import EstopClient, EstopEndpoint, EstopKeepAlive
from bosdyn.client.lease import LeaseClient, LeaseKeepAlive
from bosdyn.client.power import PowerClient, power_on_motors, safe_power_off_motors
from bosdyn.client.robot_command import RobotCommandClient, RobotCommandBuilder, blocking_stand, blocking_sit
from bosdyn.client.robot_state import RobotStateClient

logger = logging.getLogger(__name__)


class SpotBridge:
    """Bridge to Boston Dynamics Spot robot with safety features."""

    def __init__(self, hostname: str, username: str, password: str):
        self.hostname = hostname
        self.username = username
        self.password = password

        # Robot and clients
        self.robot: Optional[Robot] = None
        self.command_client: Optional[RobotCommandClient] = None
        self.state_client: Optional[RobotStateClient] = None
        self.lease_client: Optional[LeaseClient] = None
        self.power_client: Optional[PowerClient] = None
        self.estop_client: Optional[EstopClient] = None

        # Lease and E-Stop
        self.lease_keepalive: Optional[LeaseKeepAlive] = None
        self.estop_endpoint: Optional[EstopEndpoint] = None
        self.estop_keepalive: Optional[EstopKeepAlive] = None

        # Safety tracking
        self.last_velocity_time = 0.0
        self.watchdog_thread: Optional[threading.Thread] = None
        self.watchdog_active = False

        # Connection state
        self.connected = False

    def connect(self) -> Dict[str, Any]:
        """
        Connect to Spot robot and acquire control.

        Returns:
            Result dictionary with ok status and data/error
        """
        try:
            logger.info(f"Connecting to Spot at {self.hostname}...")

            # Create SDK robot object
            sdk = bosdyn.client.create_standard_sdk("SpotWebController")
            self.robot = sdk.create_robot(self.hostname)

            logger.info("Authenticating...")
            self.robot.authenticate(self.username, self.password)

            logger.info("Syncing time...")
            self.robot.time_sync.wait_for_sync()

            logger.info("Initializing clients...")
            self.command_client = self.robot.ensure_client(RobotCommandClient.default_service_name)
            self.state_client = self.robot.ensure_client(RobotStateClient.default_service_name)
            self.lease_client = self.robot.ensure_client(LeaseClient.default_service_name)
            self.power_client = self.robot.ensure_client(PowerClient.default_service_name)
            self.estop_client = self.robot.ensure_client(EstopClient.default_service_name)

            logger.info("Acquiring lease...")
            self.lease_client.take()
            self.lease_keepalive = LeaseKeepAlive(self.lease_client, must_acquire=True, return_at_exit=True)

            logger.info("Configuring E-Stop...")
            self.estop_endpoint = EstopEndpoint(self.estop_client, "SpotWebController", 9.0)
            self.estop_endpoint.force_simple_setup()
            self.estop_keepalive = EstopKeepAlive(self.estop_endpoint)

            logger.info("Starting watchdog...")
            self.watchdog_active = True
            self.watchdog_thread = threading.Thread(target=self._watchdog_loop, daemon=True)
            self.watchdog_thread.start()

            self.connected = True
            logger.info("Successfully connected to Spot")

            return {
                "ok": True,
                "data": {
                    "message": "Connected to Spot",
                    "robot_id": self.robot.get_id().serial_number,
                }
            }

        except RpcError as e:
            error_msg = str(e)
            logger.error(f"RPC error during connection: {error_msg}")
            self._cleanup()
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": error_msg,
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }
        except Exception as e:
            logger.error(f"Unexpected error during connection: {e}", exc_info=True)
            self._cleanup()
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Check network connection and Spot configuration"
                }
            }

    def disconnect(self) -> Dict[str, Any]:
        """
        Disconnect from Spot and release resources.

        Returns:
            Result dictionary
        """
        try:
            logger.info("Disconnecting from Spot...")
            self._cleanup()
            logger.info("Successfully disconnected")
            return {"ok": True, "data": {"message": "Disconnected"}}
        except Exception as e:
            logger.error(f"Error during disconnect: {e}", exc_info=True)
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Force restart may be required"
                }
            }

    def _cleanup(self):
        """Clean up connections and resources."""
        self.connected = False

        # Stop watchdog
        self.watchdog_active = False
        if self.watchdog_thread and self.watchdog_thread.is_alive():
            self.watchdog_thread.join(timeout=2.0)

        # Stop E-Stop keepalive
        if self.estop_keepalive:
            try:
                self.estop_keepalive.shutdown()
            except Exception as e:
                logger.warning(f"Error shutting down E-Stop keepalive: {e}")
            self.estop_keepalive = None

        # Stop lease keepalive
        if self.lease_keepalive:
            try:
                self.lease_keepalive.shutdown()
            except Exception as e:
                logger.warning(f"Error shutting down lease keepalive: {e}")
            self.lease_keepalive = None

        # Return lease
        if self.lease_client:
            try:
                lease = self.lease_client.lease_wallet.get_lease()
                if lease:
                    self.lease_client.return_lease(lease)
            except Exception as e:
                logger.warning(f"Error returning lease: {e}")

        # Clear references
        self.estop_endpoint = None
        self.estop_client = None
        self.power_client = None
        self.lease_client = None
        self.state_client = None
        self.command_client = None
        self.robot = None

    def _watchdog_loop(self):
        """Watchdog thread that stops robot if velocity commands timeout."""
        logger.info("Watchdog thread started")
        while self.watchdog_active:
            try:
                if self.last_velocity_time > 0:
                    time_since_last = time.time() - self.last_velocity_time
                    if time_since_last > 0.5:
                        logger.warning("Velocity timeout detected, sending stop command")
                        self._send_zero_velocity()
                        self.last_velocity_time = 0.0
                time.sleep(0.1)
            except Exception as e:
                logger.error(f"Error in watchdog: {e}", exc_info=True)
        logger.info("Watchdog thread stopped")

    def _send_zero_velocity(self):
        """Send zero velocity command (internal use)."""
        try:
            if self.robot and self.command_client:
                cmd = RobotCommandBuilder.synchro_velocity_command(
                    v_x=0, v_y=0, v_rot=0,
                    params=None
                )
                self.command_client.robot_command(cmd, end_time_secs=time.time() + 0.25)
        except Exception as e:
            logger.error(f"Error sending zero velocity: {e}")

    def get_status(self) -> Dict[str, Any]:
        """
        Get current robot status.

        Returns:
            Status dictionary with robot state information
        """
        if not self.connected or not self.robot:
            return {
                "ok": False,
                "error": {"message": "Not connected to robot"}
            }

        try:
            # Get robot state
            state = self.state_client.get_robot_state()

            # Extract key information
            battery_state = state.battery_states[0] if state.battery_states else None
            power_state = state.power_state

            status = {
                "ok": True,
                "data": {
                    "connected": True,
                    "robot_id": self.robot.get_id().serial_number,
                    "robot_nickname": self.robot.get_id().nickname,
                    "battery_percentage": battery_state.charge_percentage.value if battery_state else 0,
                    "battery_runtime": battery_state.estimated_runtime.seconds if battery_state else 0,
                    "is_powered_on": power_state.motor_power_state == power_state.STATE_ON,
                    "power_state": power_state.motor_power_state,
                    "lease_status": "active" if self.lease_keepalive else "none",
                    "estop_status": "ok" if self.estop_keepalive else "not_configured",
                    "timestamp": time.time(),
                }
            }

            return status

        except RpcError as e:
            logger.error(f"RPC error getting status: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }
        except Exception as e:
            logger.error(f"Error getting status: {e}", exc_info=True)
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Check connection to robot"
                }
            }

    def power_on(self) -> Dict[str, Any]:
        """Power on robot motors."""
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            logger.info("Powering on robot...")
            power_on_motors(self.power_client, timeout_sec=20)
            logger.info("Robot powered on")
            return {"ok": True, "data": {"message": "Powered on"}}
        except RpcError as e:
            logger.error(f"Error powering on: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }

    def power_off(self) -> Dict[str, Any]:
        """Safely power off robot motors."""
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            logger.info("Powering off robot...")
            safe_power_off_motors(self.command_client, self.state_client, timeout_sec=20)
            logger.info("Robot powered off")
            return {"ok": True, "data": {"message": "Powered off"}}
        except RpcError as e:
            logger.error(f"Error powering off: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }

    def stand(self) -> Dict[str, Any]:
        """Command robot to stand."""
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            logger.info("Commanding robot to stand...")
            blocking_stand(self.command_client, timeout_sec=10)
            logger.info("Robot standing")
            return {"ok": True, "data": {"message": "Standing"}}
        except RpcError as e:
            logger.error(f"Error standing: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }

    def sit(self) -> Dict[str, Any]:
        """Command robot to sit."""
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            logger.info("Commanding robot to sit...")
            blocking_sit(self.command_client, timeout_sec=10)
            logger.info("Robot sitting")
            return {"ok": True, "data": {"message": "Sitting"}}
        except RpcError as e:
            logger.error(f"Error sitting: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }

    def send_velocity(self, vx: float, vy: float, yaw: float) -> Dict[str, Any]:
        """
        Send velocity command to robot.

        Args:
            vx: Forward velocity in m/s
            vy: Lateral velocity in m/s
            yaw: Rotational velocity in rad/s

        Returns:
            Result dictionary
        """
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            # Clamp to safe ranges
            vx = max(-0.5, min(0.5, vx))
            vy = max(-0.5, min(0.5, vy))
            yaw = max(-0.5, min(0.5, yaw))

            # Create velocity command with short timeout
            cmd = RobotCommandBuilder.synchro_velocity_command(
                v_x=vx, v_y=vy, v_rot=yaw,
                params=None
            )

            # Send with end time
            end_time = time.time() + 0.25
            self.command_client.robot_command(cmd, end_time_secs=end_time)

            # Update watchdog
            self.last_velocity_time = time.time()

            logger.debug(f"Sent velocity: vx={vx:.2f}, vy={vy:.2f}, yaw={yaw:.2f}")

            return {
                "ok": True,
                "data": {
                    "vx": vx,
                    "vy": vy,
                    "yaw": yaw
                }
            }

        except RpcError as e:
            logger.error(f"Error sending velocity: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }

    def stop(self) -> Dict[str, Any]:
        """Emergency stop - halt all motion."""
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            logger.warning("EMERGENCY STOP commanded")
            self._send_zero_velocity()
            self.last_velocity_time = 0.0
            return {"ok": True, "data": {"message": "Stopped"}}
        except Exception as e:
            logger.error(f"Error during emergency stop: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Physical E-Stop may be required"
                }
            }

    def set_body_pose(self, height: float, roll: float = 0.0, pitch: float = 0.0, yaw: float = 0.0) -> Dict[str, Any]:
        """
        Set Spot's body pose (height and orientation) while maintaining balance.

        Args:
            height: Body height in meters (0.0 = default, -0.2 to +0.2 recommended)
            roll: Roll angle in radians
            pitch: Pitch angle in radians
            yaw: Yaw angle in radians

        Returns:
            Result dictionary
        """
        if not self.connected:
            return {"ok": False, "error": {"message": "Not connected"}}

        try:
            # Import geometry for body positioning
            from bosdyn.geometry import EulerZXY
            import math

            # Clamp values to safe ranges
            height = max(-0.3, min(0.3, height))
            roll = max(-0.3, min(0.3, roll))
            pitch = max(-0.3, min(0.3, pitch))
            yaw = max(-0.3, min(0.3, yaw))

            # Create body control parameters
            footprint_R_body = EulerZXY(yaw=yaw, roll=roll, pitch=pitch)

            # Build stand command with body pose
            cmd = RobotCommandBuilder.synchro_stand_command(
                body_height=height,
                footprint_R_body=footprint_R_body
            )

            # Send command
            self.command_client.robot_command(cmd, end_time_secs=time.time() + 2.0)

            logger.debug(f"Set body pose: height={height:.2f}m, roll={roll:.2f}, pitch={pitch:.2f}, yaw={yaw:.2f}")

            return {
                "ok": True,
                "data": {
                    "height": height,
                    "roll": roll,
                    "pitch": pitch,
                    "yaw": yaw
                }
            }

        except RpcError as e:
            logger.error(f"Error setting body pose: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": self._suggest_fix_for_error(e)
                }
            }
        except Exception as e:
            logger.error(f"Unexpected error setting body pose: {e}", exc_info=True)
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Check that robot is standing and powered on"
                }
            }

    def estop_stop(self) -> Dict[str, Any]:
        """Trigger software E-Stop."""
        if not self.connected or not self.estop_endpoint:
            return {"ok": False, "error": {"message": "E-Stop not configured"}}

        try:
            logger.warning("E-Stop triggered")
            self.estop_endpoint.stop()
            return {"ok": True, "data": {"message": "E-Stop triggered"}}
        except Exception as e:
            logger.error(f"Error triggering E-Stop: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Check E-Stop configuration"
                }
            }

    def estop_release(self) -> Dict[str, Any]:
        """Release software E-Stop."""
        if not self.connected or not self.estop_endpoint:
            return {"ok": False, "error": {"message": "E-Stop not configured"}}

        try:
            logger.info("Releasing E-Stop")
            self.estop_endpoint.allow()
            return {"ok": True, "data": {"message": "E-Stop released"}}
        except Exception as e:
            logger.error(f"Error releasing E-Stop: {e}")
            return {
                "ok": False,
                "error": {
                    "error_type": e.__class__.__name__,
                    "message": str(e),
                    "suggested_fix": "Check E-Stop configuration"
                }
            }

    def diagnose(self) -> Dict[str, Any]:
        """
        Run diagnostic checks and return report.

        Returns:
            Diagnostic report with check results
        """
        checks = []

        # DNS resolution
        try:
            socket.gethostbyname(self.hostname)
            checks.append({
                "name": "DNS Resolution",
                "status": "pass",
                "message": f"Successfully resolved {self.hostname}"
            })
        except socket.gaierror as e:
            checks.append({
                "name": "DNS Resolution",
                "status": "fail",
                "message": f"Failed to resolve {self.hostname}: {e}"
            })

        # Network connectivity
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((self.hostname, 443))
            sock.close()
            if result == 0:
                checks.append({
                    "name": "Network Connectivity",
                    "status": "pass",
                    "message": f"Can reach {self.hostname}:443"
                })
            else:
                checks.append({
                    "name": "Network Connectivity",
                    "status": "fail",
                    "message": f"Cannot reach {self.hostname}:443"
                })
        except Exception as e:
            checks.append({
                "name": "Network Connectivity",
                "status": "fail",
                "message": f"Network check failed: {e}"
            })

        # Connection status
        if self.connected:
            checks.append({
                "name": "Robot Connection",
                "status": "pass",
                "message": "Connected to robot"
            })

            # Lease status
            if self.lease_keepalive:
                checks.append({
                    "name": "Lease Status",
                    "status": "pass",
                    "message": "Lease active"
                })
            else:
                checks.append({
                    "name": "Lease Status",
                    "status": "warn",
                    "message": "No lease acquired"
                })

            # E-Stop status
            if self.estop_keepalive:
                checks.append({
                    "name": "E-Stop Status",
                    "status": "pass",
                    "message": "E-Stop configured and active"
                })
            else:
                checks.append({
                    "name": "E-Stop Status",
                    "status": "warn",
                    "message": "E-Stop not configured"
                })
        else:
            checks.append({
                "name": "Robot Connection",
                "status": "fail",
                "message": "Not connected to robot"
            })

        # Summary
        pass_count = sum(1 for c in checks if c["status"] == "pass")
        fail_count = sum(1 for c in checks if c["status"] == "fail")
        warn_count = sum(1 for c in checks if c["status"] == "warn")

        return {
            "ok": True,
            "data": {
                "summary": f"{pass_count} passed, {fail_count} failed, {warn_count} warnings",
                "checks": checks,
                "overall_status": "healthy" if fail_count == 0 else "degraded"
            }
        }

    def test_connection(self) -> Dict[str, Any]:
        """
        Comprehensive connection test.

        Returns:
            Test results with detailed status for each step
        """
        tests = []

        # Test 1: Ping
        logger.info("Testing ping...")
        try:
            result = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result.settimeout(2)
            connect_result = result.connect_ex((self.hostname, 443))
            result.close()

            if connect_result == 0:
                tests.append({
                    "name": "Network Connectivity",
                    "status": "pass",
                    "message": f"Successfully reached {self.hostname}:443"
                })
            else:
                tests.append({
                    "name": "Network Connectivity",
                    "status": "fail",
                    "message": f"Cannot reach {self.hostname}:443 (error {connect_result})"
                })
                return {"ok": True, "data": {"tests": tests, "summary": "Network unreachable"}}
        except Exception as e:
            tests.append({
                "name": "Network Connectivity",
                "status": "fail",
                "message": f"Network error: {str(e)}"
            })
            return {"ok": True, "data": {"tests": tests, "summary": "Network error"}}

        # Test 2: Robot ID (no auth needed)
        logger.info("Testing robot ID...")
        try:
            sdk = bosdyn.client.create_standard_sdk("SpotConnectionTest")
            test_robot = sdk.create_robot(self.hostname)
            robot_id = test_robot.get_id()

            tests.append({
                "name": "Robot ID Query",
                "status": "pass",
                "message": f"Robot found: {robot_id.nickname} ({robot_id.serial_number})"
            })
        except Exception as e:
            tests.append({
                "name": "Robot ID Query",
                "status": "fail",
                "message": f"Cannot get robot ID: {str(e)[:100]}"
            })
            return {"ok": True, "data": {"tests": tests, "summary": "Robot unreachable"}}

        # Test 3: Authentication
        logger.info("Testing authentication...")
        try:
            test_robot.authenticate(self.username, self.password)
            tests.append({
                "name": "Authentication",
                "status": "pass",
                "message": "Credentials accepted"
            })
        except Exception as e:
            tests.append({
                "name": "Authentication",
                "status": "fail",
                "message": f"Auth failed: {str(e)[:100]}"
            })
            return {"ok": True, "data": {"tests": tests, "summary": "Authentication failed"}}

        # Test 4: Time sync
        logger.info("Testing time sync...")
        try:
            test_robot.time_sync.wait_for_sync(timeout_sec=5)
            tests.append({
                "name": "Time Synchronization",
                "status": "pass",
                "message": "Clock synchronized"
            })
        except Exception as e:
            tests.append({
                "name": "Time Synchronization",
                "status": "warn",
                "message": f"Time sync issue: {str(e)[:100]}"
            })

        # Summary
        pass_count = sum(1 for t in tests if t["status"] == "pass")
        fail_count = sum(1 for t in tests if t["status"] == "fail")

        if fail_count == 0:
            summary = f"✓ All tests passed ({pass_count}/{len(tests)})"
        else:
            summary = f"✗ {fail_count} test(s) failed"

        return {
            "ok": True,
            "data": {
                "tests": tests,
                "summary": summary,
                "ready_to_connect": fail_count == 0
            }
        }

    def _suggest_fix_for_error(self, error: Exception) -> str:
        """Suggest fixes for common errors."""
        error_str = str(error).lower()

        if "authentication" in error_str or "credentials" in error_str:
            return "Check SPOT_USER and SPOT_PASS credentials"
        elif "connection refused" in error_str or "unreachable" in error_str:
            return "Check SPOT_HOST IP address and network connectivity"
        elif "lease" in error_str:
            return "Another client may have the lease. Check Spot admin or release other clients."
        elif "time sync" in error_str:
            return "Check system time and NTP configuration"
        elif "power" in error_str:
            return "Ensure robot is powered on before commanding movement"
        elif "estop" in error_str:
            return "Check E-Stop status - physical or software E-Stop may be active"
        else:
            return "Check connection and robot status. See logs for details."
