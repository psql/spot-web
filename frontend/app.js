// Spot Web Controller - Frontend Logic

// Global state
const state = {
    connected: false,
    motionEnabled: false,
    currentVelocity: { vx: 0, vy: 0, yaw: 0 },
    speedScale: 0.3,
    pressedKeys: new Set(),
    lastVelocitySend: 0,
    animationPlaying: false,
    animationStartTime: 0,
    animationFrame: null,
    lastPoseSend: 0,
    gaitPreset: 'normal',
    walkHeight: 0.0,
    locomotionHint: null,
    swaggerAnimationActive: false,
    swaggerStartTime: 0,
};

// WebSocket connections
let telemetryWs = null;
let logsWs = null;

// DOM elements
const elements = {
    // Connection
    connectionBadge: document.getElementById('connection-badge'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),

    // Status
    robotId: document.getElementById('robot-id'),
    robotNickname: document.getElementById('robot-nickname'),
    batteryStatus: document.getElementById('battery-status'),
    powerBadge: document.getElementById('power-badge'),
    leaseBadge: document.getElementById('lease-badge'),
    estopBadge: document.getElementById('estop-badge'),

    // Control buttons
    powerOnBtn: document.getElementById('power-on-btn'),
    powerOffBtn: document.getElementById('power-off-btn'),
    standBtn: document.getElementById('stand-btn'),
    sitBtn: document.getElementById('sit-btn'),
    stopBtn: document.getElementById('stop-btn'),

    // Animation controls
    animationPreset: document.getElementById('animation-preset'),
    animationPlayBtn: document.getElementById('animation-play-btn'),
    animationStopBtn: document.getElementById('animation-stop-btn'),
    animationStatus: document.getElementById('animation-status'),
    oscillatorControls: document.getElementById('oscillator-controls'),
    globalAmplitude: document.getElementById('global-amplitude'),
    globalAmplitudeVal: document.getElementById('global-amplitude-val'),
    animationSpeed: document.getElementById('animation-speed'),
    animationSpeedVal: document.getElementById('animation-speed-val'),
    oscFreq: document.getElementById('osc-freq'),
    oscFreqVal: document.getElementById('osc-freq-val'),

    // Body pose control
    heightSlider: document.getElementById('height-slider'),
    heightValue: document.getElementById('height-value'),
    rollSlider: document.getElementById('roll-slider'),
    rollValue: document.getElementById('roll-value'),
    pitchSlider: document.getElementById('pitch-slider'),
    pitchValue: document.getElementById('pitch-value'),
    yawSlider: document.getElementById('yaw-slider'),
    yawValue: document.getElementById('yaw-value'),
    resetPoseBtn: document.getElementById('reset-pose-btn'),

    // Motion control
    motionToggle: document.getElementById('motion-enable-toggle'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    velX: document.getElementById('vel-x'),
    velY: document.getElementById('vel-y'),
    velYaw: document.getElementById('vel-yaw'),

    // Gait control
    gaitPreset: document.getElementById('gait-preset'),
    walkHeight: document.getElementById('walk-height'),
    walkHeightVal: document.getElementById('walk-height-val'),

    // Debug
    testConnectionBtn: document.getElementById('test-connection-btn'),
    testResults: document.getElementById('test-results'),
    testResultsContent: document.getElementById('test-results-content'),
    diagnoseBtn: document.getElementById('diagnose-btn'),
    copyLogsBtn: document.getElementById('copy-logs-btn'),
    downloadLogsBtn: document.getElementById('download-logs-btn'),
    logOutput: document.getElementById('log-output'),

    // Toast
    toast: document.getElementById('toast'),
};

// API client
const api = {
    async call(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(endpoint, options);
            const data = await response.json();

            if (!data.ok) {
                showToast(`Error: ${data.error?.message || 'Unknown error'}`, 'error');
            }

            return data;
        } catch (error) {
            showToast(`Network error: ${error.message}`, 'error');
            return { ok: false, error: { message: error.message } };
        }
    },

    connect: () => api.call('/api/connect', 'POST'),
    disconnect: () => api.call('/api/disconnect', 'POST'),
    getStatus: () => api.call('/api/status'),
    powerOn: () => api.call('/api/power/on', 'POST'),
    powerOff: () => api.call('/api/power/off', 'POST'),
    stand: () => api.call('/api/command/stand', 'POST'),
    sit: () => api.call('/api/command/sit', 'POST'),
    stop: () => api.call('/api/command/stop', 'POST'),
    velocity: (vx, vy, yaw) => api.call('/api/command/velocity', 'POST', { vx, vy, yaw }),
    estopStop: () => api.call('/api/estop/stop', 'POST'),
    estopRelease: () => api.call('/api/estop/release', 'POST'),
    diagnose: () => api.call('/api/diagnose'),
};

// Toast notifications
function showToast(message, type = 'error') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 4000);
}

// Update UI functions
function updateConnectionUI(connected) {
    state.connected = connected;

    if (connected) {
        elements.connectionBadge.textContent = 'Connected';
        elements.connectionBadge.className = 'status-badge connected';
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = false;

        // Enable control buttons
        elements.powerOnBtn.disabled = false;
        elements.powerOffBtn.disabled = false;
        elements.standBtn.disabled = false;
        elements.sitBtn.disabled = false;
        elements.stopBtn.disabled = false;
        elements.motionToggle.disabled = false;

        // Enable animation and body pose controls
        elements.animationPreset.disabled = false;
        elements.animationPlayBtn.disabled = false;
        elements.globalAmplitude.disabled = false;
        elements.animationSpeed.disabled = false;
        elements.heightSlider.disabled = false;
        elements.rollSlider.disabled = false;
        elements.pitchSlider.disabled = false;
        elements.yawSlider.disabled = false;
        elements.resetPoseBtn.disabled = false;

        // Enable gait controls
        elements.gaitPreset.disabled = false;
        elements.walkHeight.disabled = false;
    } else {
        elements.connectionBadge.textContent = 'Not Connected';
        elements.connectionBadge.className = 'status-badge disconnected';
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;

        // Disable control buttons
        elements.powerOnBtn.disabled = true;
        elements.powerOffBtn.disabled = true;
        elements.standBtn.disabled = true;
        elements.sitBtn.disabled = true;
        elements.stopBtn.disabled = true;
        elements.motionToggle.disabled = true;
        elements.motionToggle.checked = false;
        state.motionEnabled = false;

        // Disable animation and body pose controls
        stopAnimation();
        elements.animationPreset.disabled = true;
        elements.animationPlayBtn.disabled = true;
        elements.animationStopBtn.disabled = true;
        elements.heightSlider.disabled = true;
        elements.rollSlider.disabled = true;
        elements.pitchSlider.disabled = true;
        elements.yawSlider.disabled = true;
        elements.resetPoseBtn.disabled = true;

        // Disable gait controls
        elements.gaitPreset.disabled = true;
        elements.walkHeight.disabled = true;

        // Reset status
        elements.robotId.textContent = '-';
        elements.robotNickname.textContent = '-';
        elements.batteryStatus.textContent = '-';
        elements.powerBadge.textContent = 'Unknown';
        elements.powerBadge.className = 'status-badge inactive';
        elements.leaseBadge.textContent = 'None';
        elements.leaseBadge.className = 'status-badge inactive';
        elements.estopBadge.textContent = 'Unknown';
        elements.estopBadge.className = 'status-badge inactive';
    }
}

function updateStatusUI(statusData) {
    if (!statusData.ok || !statusData.data) return;

    const data = statusData.data;

    // Robot info
    if (data.robot_id) {
        elements.robotId.textContent = data.robot_id;
    }
    if (data.robot_nickname) {
        elements.robotNickname.textContent = data.robot_nickname;
    }

    // Battery
    if (data.battery_percentage !== undefined) {
        const runtime = data.battery_runtime ? ` (${Math.floor(data.battery_runtime / 60)}min)` : '';
        elements.batteryStatus.textContent = `${data.battery_percentage.toFixed(0)}%${runtime}`;
    }

    // Power
    if (data.is_powered_on !== undefined) {
        elements.powerBadge.textContent = data.is_powered_on ? 'On' : 'Off';
        elements.powerBadge.className = data.is_powered_on
            ? 'status-badge active'
            : 'status-badge inactive';
    }

    // Lease
    if (data.lease_status) {
        elements.leaseBadge.textContent = data.lease_status;
        elements.leaseBadge.className = data.lease_status === 'active'
            ? 'status-badge active'
            : 'status-badge inactive';
    }

    // E-Stop
    if (data.estop_status) {
        elements.estopBadge.textContent = data.estop_status;
        elements.estopBadge.className = data.estop_status === 'ok'
            ? 'status-badge active'
            : 'status-badge warning';
    }
}

function appendLog(logEntry) {
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    const line = `[${timestamp}] [${logEntry.level}] ${logEntry.module}: ${logEntry.message}\n`;
    elements.logOutput.value += line;
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
}

// WebSocket connections
function connectTelemetryWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    telemetryWs = new WebSocket(wsUrl);

    telemetryWs.onopen = () => {
        console.log('Telemetry WebSocket connected');
    };

    telemetryWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateStatusUI(data);
    };

    telemetryWs.onclose = () => {
        console.log('Telemetry WebSocket closed, reconnecting...');
        setTimeout(connectTelemetryWebSocket, 2000);
    };

    telemetryWs.onerror = (error) => {
        console.error('Telemetry WebSocket error:', error);
    };
}

function connectLogsWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/logs`;

    logsWs = new WebSocket(wsUrl);

    logsWs.onopen = () => {
        console.log('Logs WebSocket connected');
    };

    logsWs.onmessage = (event) => {
        const logEntry = JSON.parse(event.data);
        appendLog(logEntry);
    };

    logsWs.onclose = () => {
        console.log('Logs WebSocket closed, reconnecting...');
        setTimeout(connectLogsWebSocket, 2000);
    };

    logsWs.onerror = (error) => {
        console.error('Logs WebSocket error:', error);
    };
}

// Connection handlers
async function handleConnect() {
    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = 'Connecting...';

    const result = await api.connect();

    if (result.ok) {
        updateConnectionUI(true);
        showToast('Connected to Spot', 'success');
    } else {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect';
    }
}

async function handleDisconnect() {
    // SAFETY: Stop all motion before disconnecting

    // Stop animation
    if (state.animationPlaying) {
        stopAnimation();
    }

    // Stop swagger animation
    if (state.swaggerAnimationActive) {
        stopSwaggerAnimation();
    }

    // Disable keyboard motion
    if (state.motionEnabled) {
        elements.motionToggle.checked = false;
        state.motionEnabled = false;
    }

    const result = await api.disconnect();

    if (result.ok) {
        updateConnectionUI(false);
        showToast('Disconnected from Spot', 'info');
    }
}

// Control handlers
async function handlePowerOn() {
    const result = await api.powerOn();
    if (result.ok) {
        showToast('Powering on...', 'info');
    }
}

async function handlePowerOff() {
    const result = await api.powerOff();
    if (result.ok) {
        showToast('Powering off...', 'info');
    }
}

async function handleStand() {
    const result = await api.stand();
    if (result.ok) {
        showToast('Standing...', 'info');
    }
}

async function handleSit() {
    const result = await api.sit();
    if (result.ok) {
        showToast('Sitting...', 'info');
    }
}

async function handleStop() {
    // SAFETY: Stop all motion systems

    // Stop animation if playing
    if (state.animationPlaying) {
        stopAnimation();
    }

    // Stop swagger animation
    if (state.swaggerAnimationActive) {
        stopSwaggerAnimation();
    }

    // Disable keyboard motion
    if (state.motionEnabled) {
        elements.motionToggle.checked = false;
        state.motionEnabled = false;
    }

    // Send stop command to robot
    const result = await api.stop();
    if (result.ok) {
        showToast('EMERGENCY STOP - All motion halted', 'info');
    }
}

// Motion control
function handleMotionToggle() {
    state.motionEnabled = elements.motionToggle.checked;

    if (state.motionEnabled) {
        showToast('Keyboard control enabled - Use WASD/QE', 'info');
        startMotionLoop();

        // Start swagger animation if swagger gait is selected
        if (state.gaitPreset === 'swagger') {
            startSwaggerAnimation();
        }
    } else {
        // Send zero velocity when disabled
        api.call('/api/command/velocity', 'POST', {
            vx: 0, vy: 0, yaw: 0,
            body_height: 0, locomotion_hint: null
        });
        state.currentVelocity = { vx: 0, vy: 0, yaw: 0 };
        updateVelocityDisplay();

        // Stop swagger animation
        stopSwaggerAnimation();
    }
}

function handleSpeedSlider() {
    state.speedScale = parseFloat(elements.speedSlider.value);
    elements.speedValue.textContent = state.speedScale.toFixed(1);
}

// Gait control handlers
const gaitPresets = {
    normal: { height: 0.0, hint: null, name: 'Normal Walk', animated: false },
    prowl: { height: -0.15, hint: 4, name: 'Prowl (Low & Slow)', animated: false },
    high_step: { height: 0.15, hint: 1, name: 'High Step', animated: false },
    trot: { height: 0.0, hint: 1, name: 'Trot (Fast)', animated: false },
    crawl: { height: -0.2, hint: 4, name: 'Crawl (Careful)', animated: false },
    swagger: { height: 0.0, hint: 1, name: '🕺 Swagger', animated: true },
    custom: { height: 0.0, hint: null, name: 'Custom', animated: false }
};

// Swagger animation function (double bounce + sway)
function calculateSwaggerPose(time) {
    // Double bounce - two bounces per cycle
    const bounceFreq = 3.0; // Hz - faster for walking rhythm
    const bounce = Math.sin(time * bounceFreq * 2 * Math.PI) * 0.08;

    // Sway - slower side-to-side
    const swayFreq = 1.5; // Hz
    const sway = Math.sin(time * swayFreq * 2 * Math.PI) * 0.12;

    // Slight forward pitch for swagger
    const pitch = Math.sin(time * bounceFreq * 2 * Math.PI) * 0.05;

    return {
        height: bounce,
        roll: sway,
        pitch: pitch,
        yaw: 0
    };
}

function handleGaitPresetChange() {
    const preset = elements.gaitPreset.value;
    state.gaitPreset = preset;

    if (preset !== 'custom') {
        const gait = gaitPresets[preset];
        state.walkHeight = gait.height;
        state.locomotionHint = gait.hint;

        elements.walkHeight.value = gait.height;
        elements.walkHeightVal.textContent = gait.height.toFixed(2) + 'm';

        // Handle swagger animation
        if (preset === 'swagger' && state.motionEnabled) {
            startSwaggerAnimation();
        } else {
            stopSwaggerAnimation();
        }

        showToast(`Gait: ${gait.name}`, 'info');
    } else {
        stopSwaggerAnimation();
    }
}

function handleWalkHeightChange() {
    const height = parseFloat(elements.walkHeight.value);
    state.walkHeight = height;
    elements.walkHeightVal.textContent = height.toFixed(2) + 'm';

    // Switch to custom if user manually adjusts
    if (state.gaitPreset !== 'custom') {
        elements.gaitPreset.value = 'custom';
        state.gaitPreset = 'custom';
    }
}

// Body pose control handlers
let poseUpdateTimeout = null;

function handleHeightSlider() {
    const height = parseFloat(elements.heightSlider.value);
    elements.heightValue.textContent = height.toFixed(2) + 'm';
    debouncedPoseUpdate();
}

function handleRollSlider() {
    const roll = parseFloat(elements.rollSlider.value);
    elements.rollValue.textContent = (roll * 180 / Math.PI).toFixed(1) + '°';
    debouncedPoseUpdate();
}

function handlePitchSlider() {
    const pitch = parseFloat(elements.pitchSlider.value);
    elements.pitchValue.textContent = (pitch * 180 / Math.PI).toFixed(1) + '°';
    debouncedPoseUpdate();
}

function handleYawSlider() {
    const yaw = parseFloat(elements.yawSlider.value);
    elements.yawValue.textContent = (yaw * 180 / Math.PI).toFixed(1) + '°';
    debouncedPoseUpdate();
}

function debouncedPoseUpdate() {
    clearTimeout(poseUpdateTimeout);
    poseUpdateTimeout = setTimeout(updateBodyPose, 100);
}

async function updateBodyPose() {
    const height = parseFloat(elements.heightSlider.value);
    const roll = parseFloat(elements.rollSlider.value);
    const pitch = parseFloat(elements.pitchSlider.value);
    const yaw = parseFloat(elements.yawSlider.value);

    const result = await api.call('/api/command/body-pose', 'POST', {
        height,
        roll,
        pitch,
        yaw
    });

    if (!result.ok) {
        showToast('Body pose update failed', 'error');
    }
}

async function handleResetPose() {
    elements.heightSlider.value = 0;
    elements.rollSlider.value = 0;
    elements.pitchSlider.value = 0;
    elements.yawSlider.value = 0;

    elements.heightValue.textContent = '0.00m';
    elements.rollValue.textContent = '0.0°';
    elements.pitchValue.textContent = '0.0°';
    elements.yawValue.textContent = '0.0°';

    await updateBodyPose();
    showToast('Body pose reset', 'info');
}

// Animation system
const animations = {
    bounce: {
        name: 'Bounce',
        calculate: (t, amp) => ({
            height: Math.sin(t * 2 * Math.PI) * 0.15 * amp,
            roll: 0,
            pitch: 0,
            yaw: 0
        })
    },
    sway: {
        name: 'Sway',
        calculate: (t, amp) => ({
            height: 0,
            roll: Math.sin(t * 2 * Math.PI) * 0.2 * amp,
            pitch: 0,
            yaw: 0
        })
    },
    figure8: {
        name: 'Figure 8',
        calculate: (t, amp) => ({
            height: Math.sin(t * 2 * Math.PI) * 0.1 * amp,
            roll: Math.sin(t * 2 * Math.PI) * 0.15 * amp,
            pitch: Math.sin(t * 4 * Math.PI) * 0.15 * amp,
            yaw: 0
        })
    },
    circle: {
        name: 'Circle',
        calculate: (t, amp) => ({
            height: 0,
            roll: Math.cos(t * 2 * Math.PI) * 0.2 * amp,
            pitch: Math.sin(t * 2 * Math.PI) * 0.2 * amp,
            yaw: 0
        })
    },
    wave: {
        name: 'Wave',
        calculate: (t, amp) => ({
            height: Math.sin(t * 2 * Math.PI) * 0.1 * amp,
            roll: Math.sin(t * 2 * Math.PI) * 0.15 * amp,
            pitch: Math.sin(t * 2 * Math.PI + Math.PI/2) * 0.15 * amp,
            yaw: Math.sin(t * 2 * Math.PI) * 0.1 * amp
        })
    },
    dance: {
        name: 'Dance',
        calculate: (t, amp) => ({
            height: Math.sin(t * 4 * Math.PI) * 0.12 * amp,
            roll: Math.sin(t * 3 * Math.PI) * 0.18 * amp,
            pitch: Math.sin(t * 2.5 * Math.PI) * 0.15 * amp,
            yaw: Math.sin(t * 1.5 * Math.PI) * 0.2 * amp
        })
    },
    custom: {
        name: 'Custom',
        calculate: (t, amp) => {
            const freq = parseFloat(elements.oscFreq.value);
            return {
                height: Math.sin(t * freq * 2 * Math.PI) * 0.15 * amp,
                roll: Math.sin(t * freq * 2 * Math.PI) * 0.2 * amp,
                pitch: Math.sin(t * freq * 2 * Math.PI + Math.PI/2) * 0.2 * amp,
                yaw: Math.sin(t * freq * 2 * Math.PI + Math.PI) * 0.15 * amp
            };
        }
    }
};

function handleAnimationPresetChange() {
    const preset = elements.animationPreset.value;
    if (preset === 'custom') {
        elements.oscillatorControls.style.display = 'block';
    } else {
        elements.oscillatorControls.style.display = 'none';
    }
}

function handleOscFreqChange() {
    const freq = parseFloat(elements.oscFreq.value);
    elements.oscFreqVal.textContent = freq.toFixed(1) + ' Hz';
}

function handleGlobalAmplitudeChange() {
    const amp = parseFloat(elements.globalAmplitude.value);
    elements.globalAmplitudeVal.textContent = amp.toFixed(2) + 'x';
}

function handleAnimationSpeedChange() {
    const speed = parseFloat(elements.animationSpeed.value);
    elements.animationSpeedVal.textContent = speed.toFixed(2) + 'x';
}

function startAnimation() {
    const preset = elements.animationPreset.value;
    if (preset === 'none') {
        showToast('Select an animation preset first', 'error');
        return;
    }

    state.animationPlaying = true;
    state.animationStartTime = Date.now();

    // Update UI
    elements.animationPlayBtn.style.display = 'none';
    elements.animationStopBtn.style.display = 'inline-block';
    elements.animationStopBtn.disabled = false;
    elements.animationPreset.disabled = true;
    elements.animationStatus.textContent = '⬤ PLAYING';
    elements.animationStatus.className = 'animation-status playing';

    // Disable manual controls during animation for safety
    elements.heightSlider.disabled = true;
    elements.rollSlider.disabled = true;
    elements.pitchSlider.disabled = true;
    elements.yawSlider.disabled = true;

    showToast(`▶ Playing ${animations[preset].name} animation`, 'success');
    animationLoop();
}

function stopAnimation() {
    if (!state.animationPlaying) return;

    state.animationPlaying = false;

    // Cancel animation frame
    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
    }

    // Update UI
    elements.animationPlayBtn.style.display = 'inline-block';
    elements.animationStopBtn.style.display = 'none';
    elements.animationPreset.disabled = false;
    elements.animationStatus.textContent = '';
    elements.animationStatus.className = 'animation-status';

    // Re-enable manual controls
    if (state.connected) {
        elements.heightSlider.disabled = false;
        elements.rollSlider.disabled = false;
        elements.pitchSlider.disabled = false;
        elements.yawSlider.disabled = false;
    }

    // Reset to neutral pose for safety
    api.call('/api/command/body-pose', 'POST', {
        height: 0,
        roll: 0,
        pitch: 0,
        yaw: 0
    });

    showToast('■ Animation stopped', 'info');
}

function animationLoop() {
    if (!state.animationPlaying) return;

    const preset = elements.animationPreset.value;
    const animation = animations[preset];

    if (!animation) {
        stopAnimation();
        return;
    }

    // Get global controls
    const globalAmp = parseFloat(elements.globalAmplitude.value);
    const speed = parseFloat(elements.animationSpeed.value);

    // Calculate time in seconds since animation started (with speed multiplier)
    const elapsed = ((Date.now() - state.animationStartTime) / 1000) * speed;

    // Calculate pose using animation function with global amplitude
    const pose = animation.calculate(elapsed, globalAmp);

    // Update UI display
    elements.heightValue.textContent = pose.height.toFixed(2) + 'm';
    elements.rollValue.textContent = (pose.roll * 180 / Math.PI).toFixed(1) + '°';
    elements.pitchValue.textContent = (pose.pitch * 180 / Math.PI).toFixed(1) + '°';
    elements.yawValue.textContent = (pose.yaw * 180 / Math.PI).toFixed(1) + '°';

    // SAFETY: Check if still connected
    if (!state.connected) {
        console.warn('Connection lost during animation, stopping');
        stopAnimation();
        showToast('Animation stopped: connection lost', 'error');
        return;
    }

    // Send to robot at 10Hz to avoid rate limiting
    const now = Date.now();
    if (now - state.lastPoseSend >= 100) {
        api.call('/api/command/body-pose', 'POST', pose).catch(err => {
            console.error('Animation pose update failed:', err);
            stopAnimation();
            showToast('Animation stopped: communication error', 'error');
        });
        state.lastPoseSend = now;
    }

    // Continue animation loop
    state.animationFrame = requestAnimationFrame(animationLoop);
}

// Swagger animation (runs during walking)
function startSwaggerAnimation() {
    if (state.swaggerAnimationActive) return;

    state.swaggerAnimationActive = true;
    state.swaggerStartTime = Date.now();
    swaggerAnimationLoop();
}

function stopSwaggerAnimation() {
    state.swaggerAnimationActive = false;

    // Reset pose to gait default
    if (state.connected) {
        api.call('/api/command/body-pose', 'POST', {
            height: 0,
            roll: 0,
            pitch: 0,
            yaw: 0
        });
    }
}

function swaggerAnimationLoop() {
    if (!state.swaggerAnimationActive) return;

    // Calculate time since swagger started
    const elapsed = (Date.now() - state.swaggerStartTime) / 1000;

    // Calculate swagger pose (double bounce + sway)
    const pose = calculateSwaggerPose(elapsed);

    // Send pose update at 10Hz
    const now = Date.now();
    if (now - state.lastPoseSend >= 100) {
        api.call('/api/command/body-pose', 'POST', pose).catch(err => {
            console.error('Swagger pose update failed:', err);
        });
        state.lastPoseSend = now;
    }

    // Continue loop
    requestAnimationFrame(swaggerAnimationLoop);
}

// Keyboard handling
function calculateVelocityFromKeys() {
    let vx = 0;
    let vy = 0;
    let yaw = 0;

    const maxSpeed = 0.5 * state.speedScale;
    const maxYaw = 0.5 * state.speedScale;

    if (state.pressedKeys.has('w') || state.pressedKeys.has('W')) vx += maxSpeed;
    if (state.pressedKeys.has('s') || state.pressedKeys.has('S')) vx -= maxSpeed;
    if (state.pressedKeys.has('a') || state.pressedKeys.has('A')) vy += maxSpeed;
    if (state.pressedKeys.has('d') || state.pressedKeys.has('D')) vy -= maxSpeed;
    if (state.pressedKeys.has('q') || state.pressedKeys.has('Q')) yaw += maxYaw;
    if (state.pressedKeys.has('e') || state.pressedKeys.has('E')) yaw -= maxYaw;

    return { vx, vy, yaw };
}

function updateVelocityDisplay() {
    elements.velX.textContent = state.currentVelocity.vx.toFixed(2);
    elements.velY.textContent = state.currentVelocity.vy.toFixed(2);
    elements.velYaw.textContent = state.currentVelocity.yaw.toFixed(2);
}

async function sendVelocityIfChanged(newVel) {
    // Check if velocity changed
    const changed =
        Math.abs(newVel.vx - state.currentVelocity.vx) > 0.01 ||
        Math.abs(newVel.vy - state.currentVelocity.vy) > 0.01 ||
        Math.abs(newVel.yaw - state.currentVelocity.yaw) > 0.01;

    if (changed || (Date.now() - state.lastVelocitySend > 100 && (newVel.vx !== 0 || newVel.vy !== 0 || newVel.yaw !== 0))) {
        // Send with gait params
        await api.call('/api/command/velocity', 'POST', {
            vx: newVel.vx,
            vy: newVel.vy,
            yaw: newVel.yaw,
            body_height: state.walkHeight,
            locomotion_hint: state.locomotionHint
        });

        state.currentVelocity = newVel;
        state.lastVelocitySend = Date.now();
        updateVelocityDisplay();
    }
}

function motionLoop() {
    if (!state.motionEnabled) return;

    const newVel = calculateVelocityFromKeys();
    sendVelocityIfChanged(newVel);

    requestAnimationFrame(motionLoop);
}

function startMotionLoop() {
    requestAnimationFrame(motionLoop);
}

function handleKeyDown(event) {
    if (!state.motionEnabled) return;

    // Ignore if typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        event.preventDefault();
        state.pressedKeys.add(key);
    }

    // Space bar as emergency stop
    if (event.key === ' ') {
        event.preventDefault();
        handleStop();
    }
}

function handleKeyUp(event) {
    if (!state.motionEnabled) return;

    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        event.preventDefault();
        state.pressedKeys.delete(key);
    }
}

// Debug handlers
async function handleTestConnection() {
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.textContent = 'Testing...';
    elements.testResults.style.display = 'none';

    const result = await api.call('/api/test-connection');

    if (result.ok && result.data) {
        const data = result.data;

        // Build HTML for test results
        let html = '';

        data.tests.forEach(test => {
            const icon = test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '⚠';
            html += `
                <div class="test-item ${test.status}">
                    <div class="test-icon">${icon}</div>
                    <div class="test-details">
                        <div class="test-name">${test.name}</div>
                        <div class="test-message">${test.message}</div>
                    </div>
                </div>
            `;
        });

        // Add summary
        const summaryClass = data.ready_to_connect ? 'success' : 'failure';
        html += `<div class="test-summary ${summaryClass}">${data.summary}</div>`;

        if (data.ready_to_connect) {
            html += `<div class="test-summary success">✓ Ready to connect! Click "Connect" button above.</div>`;
        }

        elements.testResultsContent.innerHTML = html;
        elements.testResults.style.display = 'block';

        // Also add to logs
        let report = `\n=== CONNECTION TEST ===\n`;
        report += `${data.summary}\n\n`;
        data.tests.forEach(test => {
            report += `[${test.status.toUpperCase()}] ${test.name}\n`;
            report += `  ${test.message}\n\n`;
        });
        elements.logOutput.value += report;
        elements.logOutput.scrollTop = elements.logOutput.scrollHeight;

        showToast(data.summary, data.ready_to_connect ? 'success' : 'error');
    } else {
        showToast('Connection test failed', 'error');
    }

    elements.testConnectionBtn.disabled = false;
    elements.testConnectionBtn.textContent = 'Test Connection';
}

async function handleDiagnose() {
    elements.diagnoseBtn.disabled = true;
    elements.diagnoseBtn.textContent = 'Running...';

    const result = await api.diagnose();

    if (result.ok) {
        const data = result.data;
        let report = `\n=== DIAGNOSTICS ===\n`;
        report += `Summary: ${data.summary}\n`;
        report += `Overall Status: ${data.overall_status}\n\n`;

        data.checks.forEach(check => {
            report += `[${check.status.toUpperCase()}] ${check.name}\n`;
            report += `  ${check.message}\n\n`;
        });

        elements.logOutput.value += report;
        elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
        showToast('Diagnostics complete', 'info');
    }

    elements.diagnoseBtn.disabled = false;
    elements.diagnoseBtn.textContent = 'Run Diagnostics';
}

async function handleCopyLogs() {
    try {
        await navigator.clipboard.writeText(elements.logOutput.value);
        showToast('Logs copied to clipboard', 'success');
    } catch (error) {
        showToast('Failed to copy logs', 'error');
    }
}

async function handleDownloadLogs() {
    try {
        const response = await fetch('/api/logs/download');
        const data = await response.json();

        if (data.ok && data.data.logs) {
            const blob = new Blob([data.data.logs], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spot_web_${new Date().toISOString().split('T')[0]}.log`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Logs downloaded', 'success');
        } else {
            showToast('Failed to download logs', 'error');
        }
    } catch (error) {
        showToast(`Download error: ${error.message}`, 'error');
    }
}

// Event listeners
elements.connectBtn.addEventListener('click', handleConnect);
elements.disconnectBtn.addEventListener('click', handleDisconnect);
elements.powerOnBtn.addEventListener('click', handlePowerOn);
elements.powerOffBtn.addEventListener('click', handlePowerOff);
elements.standBtn.addEventListener('click', handleStand);
elements.sitBtn.addEventListener('click', handleSit);
elements.stopBtn.addEventListener('click', handleStop);
elements.animationPreset.addEventListener('change', handleAnimationPresetChange);
elements.animationPlayBtn.addEventListener('click', startAnimation);
elements.animationStopBtn.addEventListener('click', stopAnimation);
elements.globalAmplitude.addEventListener('input', handleGlobalAmplitudeChange);
elements.animationSpeed.addEventListener('input', handleAnimationSpeedChange);
elements.oscFreq.addEventListener('input', handleOscFreqChange);
elements.heightSlider.addEventListener('input', handleHeightSlider);
elements.rollSlider.addEventListener('input', handleRollSlider);
elements.pitchSlider.addEventListener('input', handlePitchSlider);
elements.yawSlider.addEventListener('input', handleYawSlider);
elements.resetPoseBtn.addEventListener('click', handleResetPose);
elements.gaitPreset.addEventListener('change', handleGaitPresetChange);
elements.walkHeight.addEventListener('input', handleWalkHeightChange);
elements.motionToggle.addEventListener('change', handleMotionToggle);
elements.speedSlider.addEventListener('input', handleSpeedSlider);
elements.testConnectionBtn.addEventListener('click', handleTestConnection);
elements.diagnoseBtn.addEventListener('click', handleDiagnose);
elements.copyLogsBtn.addEventListener('click', handleCopyLogs);
elements.downloadLogsBtn.addEventListener('click', handleDownloadLogs);

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// Prevent keys from triggering when focus is lost
window.addEventListener('blur', () => {
    state.pressedKeys.clear();
});

// Initialize
console.log('Spot Web Controller initialized');
updateConnectionUI(false);

// Connect WebSockets
connectTelemetryWebSocket();
connectLogsWebSocket();
