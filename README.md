# Spot Web Controller

A local web-based controller for Boston Dynamics Spot robot. Control Spot from your browser with real-time telemetry, keyboard controls, and comprehensive safety features.

## Features

- **Real-time Control**: Direct local connection over LAN
- **Keyboard Control**: WASD/QE controls for intuitive movement
- **Safety Features**: Multiple layers including lease management, E-Stop, velocity timeouts, and watchdog
- **Live Telemetry**: 5Hz WebSocket updates with battery, power state, and robot status
- **Debug Console**: Real-time log streaming and diagnostics
- **No Build Required**: Vanilla HTML/CSS/JS frontend - just start and browse

## Prerequisites

- **Python 3.10+** (tested on Python 3.11)
- **Boston Dynamics Spot SDK**
- **macOS** (compatible with Apple Silicon)
- **Spot Robot** on same Wi-Fi network
- **Valid Spot credentials** (admin username and password)

## Setup

### 1. Clone or Navigate to Repository

```bash
cd /Users/pasquale/dev/spot-web
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set your Spot's configuration:

```bash
# Required: Spot robot connection
SPOT_HOST=192.168.80.3        # Your Spot's IP address
SPOT_USER=admin                # Your Spot username
SPOT_PASS=your_password_here   # Your Spot password

# Optional: Server binding
BIND_HOST=0.0.0.0
BIND_PORT=8080

# Optional: Logging
LOG_LEVEL=INFO
```

## Finding Your Spot's IP Address

You can find your Spot's IP address using one of these methods:

### Method 1: Spot Admin Panel
- Connect to Spot's Wi-Fi network directly
- Navigate to `https://192.168.80.3` in your browser
- Check the network settings

### Method 2: Use bosdyn-ping utility
```bash
# After installing dependencies
python -m bosdyn.client 192.168.80.3 directory list
```

### Method 3: Network Scanner
Use your router's admin interface or a network scanning tool like `nmap`:
```bash
nmap -sn 192.168.1.0/24
```

Look for devices with hostname containing "spot" or manufacturer "Boston Dynamics".

## Running the Server

1. Activate your virtual environment (if not already active):
```bash
source venv/bin/activate
```

2. Start the server:
```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8080
```

3. Open your browser and navigate to:
```
http://localhost:8080
```

## First-Time Connection

1. Click the **Connect** button
2. Wait for the status badge to turn green
3. Verify that "Lease" shows "active" and "E-Stop" shows "ok"
4. Click **Power On** before commanding any movement
5. Click **Stand** to make Spot stand up
6. Enable **Keyboard Control** to use WASD controls

## Controls

### Connection
- **Connect**: Establish connection to Spot and acquire lease
- **Disconnect**: Release lease and disconnect

### Power Control
- **Power On**: Turn on Spot's motors (required before movement)
- **Power Off**: Safely power off Spot's motors

### Mobility
- **Stand**: Command Spot to stand up
- **Sit**: Command Spot to sit down
- **STOP**: Emergency stop - immediately halt all movement

### Keyboard Control

Enable the "Keyboard Control" toggle, then use:

- **W**: Move forward
- **S**: Move backward
- **A**: Strafe left
- **D**: Strafe right
- **Q**: Rotate left
- **E**: Rotate right
- **Space**: Emergency stop

**Speed Scale**: Adjust the slider to control movement speed (0.1x to 1.0x)

### Debug Panel
- **Run Diagnostics**: Check network connectivity, DNS resolution, and robot services
- **Copy Logs**: Copy all logs to clipboard
- **Download Logs**: Download full log file

## Safety Features

### Lease Management
The controller automatically acquires and maintains a lease when connected. This prevents multiple clients from controlling Spot simultaneously. If another client has the lease, connection will fail.

### E-Stop
Software E-Stop is configured automatically on connection. The E-Stop keepalive runs continuously while connected. If the connection drops, the E-Stop will trigger.

### Velocity Timeouts
All velocity commands have a 250ms timeout. If no new command is received within this window, Spot will stop moving.

### Watchdog
A background watchdog thread monitors velocity commands. If more than 500ms passes without a velocity command (and motion was previously active), the watchdog sends a zero-velocity command to ensure Spot stops.

### Command Validation
All velocity values are clamped to safe ranges:
- Linear velocity: ±0.5 m/s
- Rotational velocity: ±0.5 rad/s

## Troubleshooting

### Can't Reach Spot

**Symptoms**: Connection fails with "connection refused" or "unreachable" error

**Solutions**:
1. Verify Spot's IP address: `ping 192.168.80.3` (or your configured IP)
2. Ensure both your Mac and Spot are on the same Wi-Fi network
3. Check that no firewall is blocking connections
4. Try connecting to Spot's admin panel in a browser to verify network access

### Lease Already in Use

**Symptoms**: Connection fails with "lease" error

**Solutions**:
1. Check if another client (tablet controller, other software) has the lease
2. Access Spot's admin panel at `https://192.168.80.3` to view/release leases
3. Wait 30 seconds and try again (leases timeout after inactivity)
4. Power cycle Spot if lease is stuck

### E-Stop Not Configured

**Symptoms**: E-Stop status shows "not_configured" or "warning"

**Solutions**:
1. Disconnect and reconnect
2. Check Spot's admin panel for E-Stop status
3. Verify no hardware E-Stop is engaged
4. Check logs for specific E-Stop errors

### Network Blocks Device-to-Device Communication

**Symptoms**: Can reach internet but not Spot, or can reach Spot's admin but controller fails

**Solutions**:
1. Check if your Wi-Fi has "client isolation" or "AP isolation" enabled
2. Use a different Wi-Fi network without isolation
3. Connect both devices to a dedicated router
4. Check router settings for device-to-device blocking

### Time Sync Issues

**Symptoms**: Connection succeeds but commands fail with "time sync" errors

**Solutions**:
1. Verify your Mac's system time is correct
2. Enable NTP (Network Time Protocol) in System Preferences
3. Restart Spot and try again
4. Check Spot's time settings in admin panel

### Authentication Failed

**Symptoms**: Connection fails with "authentication" or "credentials" error

**Solutions**:
1. Verify `SPOT_USER` and `SPOT_PASS` in `.env` file
2. Check credentials by logging into Spot's admin panel
3. Ensure no special characters are causing parsing issues
4. Try resetting Spot's admin password if you have access

### Python/Dependency Issues

**Symptoms**: Import errors or module not found

**Solutions**:
1. Ensure virtual environment is activated: `source venv/bin/activate`
2. Reinstall dependencies: `pip install -r backend/requirements.txt`
3. Verify Python version: `python --version` (should be 3.10+)
4. On Apple Silicon Macs, ensure you're using native Python, not Rosetta

## Development

### Project Structure

```
spot-web/
├── README.md              # This file
├── .env.example           # Environment template
├── backend/
│   ├── app.py            # FastAPI server
│   ├── spot_bridge.py    # Spot SDK wrapper
│   ├── config.py         # Configuration
│   ├── logging_setup.py  # Logging configuration
│   └── requirements.txt  # Python dependencies
└── frontend/
    ├── index.html        # UI
    ├── app.js           # Frontend logic
    └── styles.css       # Styling
```

### Architecture

- **Backend**: FastAPI server with REST + WebSocket endpoints
- **Frontend**: Vanilla JavaScript with WebSocket clients
- **Bridge**: Spot SDK wrapper with safety features
- **Communication**: REST for commands, WebSocket for telemetry and logs

### Logs

Logs are written to:
- Console (stdout)
- `spot_web.log` file
- In-memory buffer (streamed via WebSocket)

Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

## License

MIT License - Feel free to modify and use for your projects.

## Contributing

This is a personal project, but suggestions and improvements are welcome. Please test thoroughly before submitting changes, especially safety-related features.

## Acknowledgments

Built with:
- [Boston Dynamics Spot SDK](https://github.com/boston-dynamics/spot-sdk)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Uvicorn](https://www.uvicorn.org/)

## Safety Warning

**IMPORTANT**: This software controls a physical robot. Always:
- Maintain visual line of sight with Spot
- Keep the physical E-Stop accessible
- Test in a safe, open area
- Be prepared to use emergency stop
- Follow all Boston Dynamics safety guidelines
- Ensure proper training before operating Spot

The software includes safety features, but YOU are responsible for safe operation of the robot.
