// Lightweight Live Pose Control - ZERO overhead, instant response
// Uses keyboard for real-time body pose control

class LivePoseControl {
    constructor() {
        this.active = false;
        this.currentPose = { roll: 0, pitch: 0, yaw: 0, height: 0 };
        this.speed = 1.0;
        this.pressedKeys = new Set();
        this.lastUpdateTime = 0;
        this.animationFrame = null;

        // DOM elements
        this.rollText = document.getElementById('pose-roll');
        this.pitchText = document.getElementById('pose-pitch');
        this.yawText = document.getElementById('pose-yaw');
        this.robotVisual = document.getElementById('robot-visual');
    }

    start() {
        if (this.active) return;

        this.active = true;
        this.currentPose = { roll: 0, pitch: 0, yaw: 0, height: 0 };

        // Add keyboard listeners
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Start update loop
        this.updateLoop();

        console.log('Live pose control active - use arrow keys!');
    }

    stop() {
        this.active = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // Reset to neutral
        this.currentPose = { roll: 0, pitch: 0, yaw: 0, height: 0 };
        this.sendToSpot(this.currentPose);
        this.updateDisplay();

        console.log('Live pose control stopped');
    }

    handleKeyDown(e) {
        if (!this.active) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key;
        this.pressedKeys.add(key);

        // Reset on space
        if (key === ' ') {
            e.preventDefault();
            this.currentPose = { roll: 0, pitch: 0, yaw: 0, height: 0 };
            this.sendToSpot(this.currentPose);
        }
    }

    handleKeyUp(e) {
        if (!this.active) return;
        this.pressedKeys.delete(e.key);
    }

    updateLoop() {
        if (!this.active) return;

        // Calculate pose based on pressed keys
        const delta = 0.01 * this.speed;  // Radians per frame

        // Arrow keys for roll/pitch
        if (this.pressedKeys.has('ArrowLeft')) {
            this.currentPose.roll = Math.max(-0.3, this.currentPose.roll - delta);
        }
        if (this.pressedKeys.has('ArrowRight')) {
            this.currentPose.roll = Math.min(0.3, this.currentPose.roll + delta);
        }
        if (this.pressedKeys.has('ArrowUp')) {
            this.currentPose.pitch = Math.max(-0.3, this.currentPose.pitch + delta);
        }
        if (this.pressedKeys.has('ArrowDown')) {
            this.currentPose.pitch = Math.min(0.3, this.currentPose.pitch - delta);
        }

        // A/D for yaw
        if (this.pressedKeys.has('a') || this.pressedKeys.has('A')) {
            this.currentPose.yaw = Math.max(-0.3, this.currentPose.yaw - delta);
        }
        if (this.pressedKeys.has('d') || this.pressedKeys.has('D')) {
            this.currentPose.yaw = Math.min(0.3, this.currentPose.yaw + delta);
        }

        // W/S for height
        if (this.pressedKeys.has('w') || this.pressedKeys.has('W')) {
            this.currentPose.height = Math.min(0.3, this.currentPose.height + delta);
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('S')) {
            this.currentPose.height = Math.max(-0.3, this.currentPose.height - delta);
        }

        // Update display
        this.updateDisplay();

        // Send to Spot at 20Hz
        const now = Date.now();
        if (now - this.lastUpdateTime >= 50) {
            this.sendToSpot(this.currentPose);
            this.lastUpdateTime = now;
        }

        this.animationFrame = requestAnimationFrame(() => this.updateLoop());
    }

    updateDisplay() {
        this.rollText.textContent = (this.currentPose.roll * 180 / Math.PI).toFixed(1) + '°';
        this.pitchText.textContent = (this.currentPose.pitch * 180 / Math.PI).toFixed(1) + '°';
        this.yawText.textContent = (this.currentPose.yaw * 180 / Math.PI).toFixed(1) + '°';

        // Update visual robot
        if (this.robotVisual) {
            this.robotVisual.style.transform =
                `rotateZ(${this.currentPose.roll}rad) ` +
                `rotateX(${this.currentPose.pitch}rad) ` +
                `rotateY(${this.currentPose.yaw}rad) ` +
                `translateY(${-this.currentPose.height * 100}px)`;
        }
    }

    async sendToSpot(pose) {
        try {
            await fetch('/api/command/body-pose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pose)
            });
        } catch (error) {
            console.error('Send error:', error);
        }
    }

    setSpeed(value) {
        this.speed = value;
    }
}

window.livePoseControl = new LivePoseControl();
console.log('Live pose control ready!');
