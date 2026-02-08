// MediaPipe Hand Tracking for Spot Body Control
// Maps hand orientation to Spot's body pose in real-time

class HandControl {
    constructor() {
        this.active = false;
        this.hands = null;
        this.camera = null;
        this.lastHandPose = { roll: 0, pitch: 0, yaw: 0 };
        this.sensitivity = 1.0;
        this.lastUpdateTime = 0;

        // DOM elements
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.canvasCtx = this.canvas?.getContext('2d');
        this.statusText = document.getElementById('hand-status');
        this.rollText = document.getElementById('hand-roll');
        this.pitchText = document.getElementById('hand-pitch');
        this.yawText = document.getElementById('hand-yaw');
    }

    async initialize() {
        if (!window.Hands) {
            console.error('MediaPipe Hands not loaded');
            return false;
        }

        try {
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7
            });

            this.hands.onResults((results) => this.onResults(results));

            // Start camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.hands) {
                        await this.hands.send({ image: this.video });
                    }
                },
                width: 640,
                height: 480
            });

            await this.camera.start();

            // Set canvas size
            this.canvas.width = 640;
            this.canvas.height = 480;

            return true;
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            return false;
        }
    }

    onResults(results) {
        if (!this.active || !this.canvasCtx) return;

        // Clear and draw video frame
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            // Draw hand landmarks
            this.drawHandLandmarks(landmarks);

            // Calculate hand orientation
            const orientation = this.calculateHandOrientation(landmarks);

            // Update UI
            this.updateOrientationDisplay(orientation);

            // Send to Spot (throttled to 10Hz)
            const now = Date.now();
            if (now - this.lastUpdateTime >= 100) {
                this.sendToSpot(orientation);
                this.lastUpdateTime = now;
            }

            this.statusText.textContent = '✋ Hand detected';
            this.statusText.style.color = '#00ff88';
        } else {
            this.statusText.textContent = 'No hand detected';
            this.statusText.style.color = '#ff4444';

            // Reset to neutral when no hand
            if (Date.now() - this.lastUpdateTime > 500) {
                this.sendToSpot({ roll: 0, pitch: 0, yaw: 0, height: 0 });
            }
        }

        this.canvasCtx.restore();
    }

    drawHandLandmarks(landmarks) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],  // Index
            [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
            [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
            [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
            [5, 9], [9, 13], [13, 17]  // Palm
        ];

        this.canvasCtx.strokeStyle = '#00d9ff';
        this.canvasCtx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.canvasCtx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.canvasCtx.stroke();
        });

        // Draw points
        landmarks.forEach(landmark => {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                5, 0, 2 * Math.PI
            );
            this.canvasCtx.fillStyle = '#00ff88';
            this.canvasCtx.fill();
        });
    }

    calculateHandOrientation(landmarks) {
        // Use wrist (0) and middle finger base (9) to establish hand plane
        const wrist = landmarks[0];
        const middleBase = landmarks[9];
        const indexTip = landmarks[8];
        const pinkyBase = landmarks[17];

        // Calculate roll (left/right tilt)
        // Compare pinky base to index tip
        const deltaX = pinkyBase.x - indexTip.x;
        const roll = Math.atan2(deltaX, 0.5) * this.sensitivity;

        // Calculate pitch (forward/back tilt)
        // Use z-depth difference between wrist and fingers
        const avgFingerZ = (landmarks[8].z + landmarks[12].z + landmarks[16].z + landmarks[20].z) / 4;
        const pitch = (wrist.z - avgFingerZ) * 5 * this.sensitivity;

        // Calculate yaw (rotation)
        // Use angle of hand across frame
        const deltaY = middleBase.y - wrist.y;
        const yaw = Math.atan2(middleBase.x - wrist.x, deltaY) * this.sensitivity;

        // Clamp to safe ranges
        return {
            roll: Math.max(-0.3, Math.min(0.3, roll)),
            pitch: Math.max(-0.3, Math.min(0.3, pitch)),
            yaw: Math.max(-0.3, Math.min(0.3, yaw)),
            height: 0 // Could add height based on hand height if desired
        };
    }

    updateOrientationDisplay(orientation) {
        this.rollText.textContent = (orientation.roll * 180 / Math.PI).toFixed(1) + '°';
        this.pitchText.textContent = (orientation.pitch * 180 / Math.PI).toFixed(1) + '°';
        this.yawText.textContent = (orientation.yaw * 180 / Math.PI).toFixed(1) + '°';
    }

    async sendToSpot(orientation) {
        try {
            await fetch('/api/command/body-pose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orientation)
            });
        } catch (error) {
            console.error('Failed to send pose to Spot:', error);
        }
    }

    async start() {
        if (this.active) return;

        const initialized = await this.initialize();
        if (!initialized) {
            alert('Failed to initialize hand tracking. Check camera permissions.');
            return;
        }

        this.active = true;
        console.log('Hand control active');
    }

    stop() {
        this.active = false;

        if (this.camera) {
            this.camera.stop();
        }

        // Reset to neutral
        this.sendToSpot({ roll: 0, pitch: 0, yaw: 0, height: 0 });

        this.statusText.textContent = 'Hand control disabled';
        this.statusText.style.color = '#666';

        console.log('Hand control stopped');
    }

    setSensitivity(value) {
        this.sensitivity = value;
    }
}

// Global hand control instance
window.handControl = new HandControl();
