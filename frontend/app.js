// Spot Web Controller - Frontend Logic

// Global state
const state = {
    connected: false,
    motionEnabled: false,
    currentVelocity: { vx: 0, vy: 0, yaw: 0 },
    speedScale: 0.3,
    pressedKeys: new Set(),
    lastVelocitySend: 0,
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

    // Motion control
    motionToggle: document.getElementById('motion-enable-toggle'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    velX: document.getElementById('vel-x'),
    velY: document.getElementById('vel-y'),
    velYaw: document.getElementById('vel-yaw'),

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
    // Disable motion first
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
    // Disable motion
    if (state.motionEnabled) {
        elements.motionToggle.checked = false;
        state.motionEnabled = false;
    }

    const result = await api.stop();
    if (result.ok) {
        showToast('STOPPED', 'info');
    }
}

// Motion control
function handleMotionToggle() {
    state.motionEnabled = elements.motionToggle.checked;

    if (state.motionEnabled) {
        showToast('Keyboard control enabled - Use WASD/QE', 'info');
        startMotionLoop();
    } else {
        // Send zero velocity when disabled
        api.velocity(0, 0, 0);
        state.currentVelocity = { vx: 0, vy: 0, yaw: 0 };
        updateVelocityDisplay();
    }
}

function handleSpeedSlider() {
    state.speedScale = parseFloat(elements.speedSlider.value);
    elements.speedValue.textContent = state.speedScale.toFixed(1);
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
        await api.velocity(newVel.vx, newVel.vy, newVel.yaw);
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
