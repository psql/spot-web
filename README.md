# Spot Web Controller

A local web-based controller for Boston Dynamics Spot robot. Control Spot from your browser with real-time telemetry, keyboard controls, and comprehensive safety features.

## Features

### Core Controls
- **Real-time Control**: Direct local connection over LAN (WiFi AP or client mode)
- **Keyboard Control**: WASD/QE controls for intuitive movement with adjustable speed
- **Live Telemetry**: 1Hz WebSocket updates with battery, power state, and robot status
- **Debug Console**: Real-time log streaming, diagnostics, and connection testing
- **No Build Required**: Vanilla HTML/CSS/JS frontend - just start and browse

### Advanced Animation & Gait Controls
- **6 Custom Gaits**: Normal, Prowl, High Step, Trot, Crawl, Swagger
- **Body Pose Animations**: 8 preset animations (Bounce, Sway, Figure 8, Circle, Wave, Dance, Tail Wag, Custom)
- **Swagger Walk**: Dynamic bouncing while walking with tunable oscillator controls
- **Tail Wag**: Excited dog play bow with hip wiggle animation
- **Real-time Tuning**: Adjust amplitude, frequency, phase while moving
- **Animation Presets**: 6 quick-apply swagger personalities (Subtle, Confident, Dramatic, Bouncy, Prowling, Mechanical)

### Safety Features
- **Multiple E-Stop Methods**: Emergency stop button, Space bar, auto-stop on disconnect
- **Lease Management**: Automatic acquisition and maintenance with keepalive
- **Velocity Timeouts**: All motion commands timeout after 250ms
- **Watchdog Thread**: Auto-stops robot if commands timeout (500ms)
- **Animation Safety**: All animations stop on disconnect or error
- **Command Validation**: All values clamped to safe ranges

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
- **Disconnect**: Release lease and disconnect safely
- **Test Connection**: Run comprehensive connection diagnostics

### Power Control
- **Power On**: Turn on Spot's motors (required before movement)
- **Power Off**: Safely power off Spot's motors

### Mobility
- **Stand**: Command Spot to stand up
- **Sit**: Command Spot to sit down
- **STOP**: Emergency stop - immediately halt all movement and animations

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

### Custom Gaits (Walk Styles)

Select different gaits from the "Gait Preset" dropdown to change how Spot walks:

1. **Normal Walk** - Standard gait at default height
2. **Prowl** 🐆 - Low crouch (-15cm), slow crawl gait for sneaking
3. **High Step** 🦒 - Elevated walk (+15cm), high trot for obstacles
4. **Trot** 🏃 - Fast trot gait for quick movement
5. **Crawl** 🐢 - Very low (-20cm), careful movement for stability
6. **Swagger** 🕺 - Bouncing walk with tunable oscillator controls
7. **Custom** ⚙️ - Manual height control with custom locomotion

**Walk Height Slider**: Fine-tune body height (-30cm to +30cm) while walking

### Swagger Walk (Advanced Animation Control)

When "Swagger" gait is selected, additional controls appear:

**Vertical Motion:**
- **Bounce Amplitude** (0-15cm): How high Spot bounces while walking
- **Bounce Speed** (0.5-5 Hz): Bounces per second (ties to step rhythm)
- **Bob Delay** (0-180°): Lag/follow-through in vertical motion

**Lateral Motion:**
- **Sway Amplitude** (0-20cm): Side-to-side movement amount
- **Sway Speed** (0.5-4 Hz): Independent sway rhythm
- **Sway Phase** (0-360°): Timing offset from bounce

**Quick Personality Presets:**
- **Subtle**: Gentle, professional (4cm bounce, 6cm sway)
- **Confident**: Classic swagger (8cm bounce, 12cm sway) ⭐ Recommended
- **Dramatic**: Exaggerated character (12cm bounce, 18cm sway, offset)
- **Bouncy**: High energy (15cm bounce, fast)
- **Prowling**: Sneaky stalking (slow, big sway)
- **Mechanical**: Robotic precision (synchronized motion)

**Note**: Due to Spot SDK limitations, only vertical bounce works during active walking. Full multi-axis control works while standing in Animation Mode.

### Body Pose Animations (Standing)

Select animations from Animation Mode dropdown and click ▶ Play:

1. **Bounce** - Vertical bouncing motion
2. **Sway** - Side-to-side swaying
3. **Figure 8** - Complex 3D figure-8 motion
4. **Circle** - Circular roll + pitch pattern
5. **Wave** - Multi-axis wave motion
6. **Dance** - Complex multi-frequency dance moves
7. **🐕 Tail Wag** - Excited dog play bow with hip wiggle
8. **Custom** - Tunable frequency and amplitude

**Animation Controls:**
- **Amplitude** (0.1-1.0x): Overall intensity of movements
- **Speed** (0.25-2.0x): Animation speed multiplier
- **Stop Button**: Halt animation and return to neutral pose

**Tail Wag Controls (when selected):**
- **Wag Intensity** (0.1-1.5x): How much the hips wiggle
- **Wag Speed** (1-6 Hz): How fast the wag (3 Hz = happy, 6 Hz = very excited!)

### Manual Body Pose Control

Fine-tune Spot's pose while standing:

- **Height** (-30cm to +30cm): Raise or lower body
- **Roll** (±17°): Tilt side to side
- **Pitch** (±17°): Tilt forward/backward
- **Yaw** (±17°): Rotate body orientation
- **Reset Button**: Return to default neutral stance

### Debug Panel
- **Test Connection**: Comprehensive pre-flight check (network, robot ID, auth, time sync)
- **Run Diagnostics**: Check connectivity, DNS, robot services
- **Copy Logs**: Copy all logs to clipboard
- **Download Logs**: Download full log file

## Usage Examples

### Basic Walking

```
1. Connect to Spot (192.168.80.3 or your network IP)
2. Click "Stand"
3. Enable "Keyboard Control"
4. Use WASD to walk around
5. Adjust "Speed Scale" for faster/slower movement
```

### Walking with Custom Gait

```
Try "Prowl" mode:
1. Select "Prowl" from Gait Preset
2. Enable keyboard control
3. Press W to walk forward
4. Spot walks in low, crouched position 🐆

Try "Swagger" mode:
1. Select "Swagger" gait
2. Click "Confident" preset button
3. Enable keyboard control
4. Press W to walk
5. Spot bounces while walking! 🕺
6. Adjust "Bounce" slider (try 12cm for more energy)
```

### Creating Animated Performances

```
Tail Wag (Standing):
1. Make sure Spot is standing
2. Animation Mode → Select "Tail Wag"
3. Set "Wag Intensity" to 1.5x
4. Set "Wag Speed" to 5 Hz
5. Click ▶ Play
6. Spot does excited dog play bow with hip wiggle! 🐶

Dance Routine (Standing):
1. Spot standing
2. Animation Mode → Select "Dance"
3. Set Amplitude to 0.8x
4. Set Speed to 1.5x
5. Click Play
6. Complex multi-axis dance! 💃
```

### Dialing in Walk Personality (Advanced)

```
Creating "Confident Strut":
1. Select "Swagger" gait
2. Click "Confident" preset (or customize):
   - Bounce: 10cm at 3.0 Hz
   - Sway: 12cm at 1.5 Hz
   - Bob Delay: 0° (synchronized)
   - Sway Phase: 0° (in sync with bounce)
3. Enable keyboard
4. Walk around with WASD
5. Adjust sliders in real-time to perfect the personality!
```

## Safety Features

### Multiple E-Stop Methods
- **Large Red STOP Button**: Primary emergency stop
- **Space Bar**: Quick keyboard emergency stop
- **Disconnect Button**: Stops all motion before disconnecting
- **Auto-Stop**: Triggers on connection loss or errors

### Lease Management
The controller automatically acquires and maintains a lease when connected. This prevents multiple clients from controlling Spot simultaneously. If another client has the lease, connection will fail.

### E-Stop
Software E-Stop is configured automatically on connection. The E-Stop keepalive runs continuously while connected. If the connection drops, the E-Stop will trigger.

### Velocity Timeouts
All velocity commands have a 250ms timeout. If no new command is received within this window, Spot will stop moving.

### Watchdog
A background watchdog thread monitors velocity commands. If more than 500ms passes without a velocity command (and motion was previously active), the watchdog sends a zero-velocity command to ensure Spot stops.

### Animation Safety
- All animations automatically stop on disconnect
- Emergency stop halts all animations immediately
- Connection loss detection with auto-stop
- Animations reset to neutral pose when stopped

### Command Validation
All values are clamped to safe ranges:
- Linear velocity: ±0.5 m/s
- Rotational velocity: ±0.5 rad/s
- Body height: ±0.3 m
- Body angles: ±0.3 rad (±17°)

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

### Animation/Gait Issues

**Symptoms**: Animations don't play or gaits don't work

**Solutions**:
1. **Browser cache**: Do hard refresh (`Cmd + Shift + R`)
2. **Check console**: Open DevTools (`Cmd + Option + I`), look for JavaScript errors
3. **Verify connection**: Make sure Spot is connected (green status badge)
4. **Robot state**: Animations require Spot to be standing, not sitting
5. **Gait switching**: If walk stops after changing gaits, disable and re-enable keyboard control

**Swagger doesn't affect walk:**
- Only bounce (height) works during active walking (Spot SDK limitation)
- For full multi-axis control, use Animation Mode while standing
- Sway/twist/pitch work perfectly in standing animations

**Tail wag orientation wrong:**
- Should show head down, butt up (play bow pose)
- If inverted, check that you're using latest version
- Positive pitch = butt up is correct behavior

### Keyboard Control Not Working

**Symptoms**: Pressing WASD keys doesn't move Spot

**Solutions**:
1. **Check toggle**: Ensure "Enable Keyboard Control" is ON (green)
2. **Check focus**: Click on page background (not in input field)
3. **Browser console**: Check for JavaScript errors (red text)
4. **Reconnect**: Try disconnecting and reconnecting to Spot
5. **Power state**: Ensure Spot is powered on before movement
6. **Hard refresh**: Clear browser cache with `Cmd + Shift + R`

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

## Advanced Tips

### Creating Custom Walk Personalities

Use the Swagger controls like an animator:

1. **Start with a preset** that's close to your goal
2. **Adjust bounce** for energy level (more = energetic, less = tired)
3. **Adjust sway** for confidence (more = swagger, less = focused)
4. **Tune frequencies** to match desired step rhythm
5. **Experiment with phase offsets** for complex timing
6. **Save your favorites** by noting the values

### Combining Features

- **Prowl + Slow Speed**: Sneaky stalking movement
- **High Step + Normal Speed**: Confident elevated walk
- **Swagger + Medium Bounce**: Casual confident walk
- **Trot + High Speed**: Fast energetic movement

### Performance Optimization

- **Reduce telemetry rate**: Currently 1Hz, can be adjusted in `backend/app.py`
- **Adjust animation update rate**: Default 10Hz for smooth motion
- **Network quality**: Use 5GHz WiFi for better responsiveness
- **Reduce logging**: Set `LOG_LEVEL=WARNING` in `.env` for production

## API Endpoints

The controller exposes REST and WebSocket endpoints:

### REST Endpoints

- `GET /api/health` - Server health and config
- `POST /api/connect` - Connect to Spot
- `POST /api/disconnect` - Disconnect from Spot
- `GET /api/status` - Get robot status
- `GET /api/test-connection` - Run connection diagnostics
- `POST /api/power/on` - Power on motors
- `POST /api/power/off` - Power off motors
- `POST /api/command/stand` - Stand command
- `POST /api/command/sit` - Sit command
- `POST /api/command/stop` - Emergency stop
- `POST /api/command/velocity` - Send velocity with gait params
- `POST /api/command/body-pose` - Set body pose (height, roll, pitch, yaw)
- `POST /api/estop/stop` - Trigger E-Stop
- `POST /api/estop/release` - Release E-Stop
- `GET /api/diagnose` - Run diagnostics
- `GET /api/logs/download` - Download log file

### WebSocket Endpoints

- `WS /ws/telemetry` - Real-time status updates (1Hz)
- `WS /ws/logs` - Real-time log streaming

## Acknowledgments

Built with:
- [Boston Dynamics Spot SDK](https://github.com/boston-dynamics/spot-sdk)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Uvicorn](https://www.uvicorn.org/)

Animation principles inspired by:
- Richard Williams' "The Animator's Survival Kit"
- Character animation timing and spacing techniques

## Safety Warning

**IMPORTANT**: This software controls a physical robot. Always:
- Maintain visual line of sight with Spot
- Keep the physical E-Stop accessible
- Test in a safe, open area
- Be prepared to use emergency stop
- Follow all Boston Dynamics safety guidelines
- Ensure proper training before operating Spot

The software includes safety features, but YOU are responsible for safe operation of the robot.
