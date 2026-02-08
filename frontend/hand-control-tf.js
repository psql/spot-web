// Simplified Hand Tracking using TensorFlow.js
// More reliable offline than MediaPipe

class HandControlTF {
    constructor() {
        this.active = false;
        this.model = null;
        this.video = document.getElementById('hand-video');
        this.canvas = document.getElementById('hand-canvas');
        this.canvasCtx = this.canvas?.getContext('2d');
        this.statusText = document.getElementById('hand-status');
        this.rollText = document.getElementById('hand-roll');
        this.pitchText = document.getElementById('hand-pitch');
        this.yawText = document.getElementById('hand-yaw');
        this.sensitivity = 1.0;
        this.lastUpdateTime = 0;
        this.animationFrame = null;
    }

    async initialize() {
        console.log('Initializing TensorFlow Handpose...');

        try {
            // Request camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            this.video.srcObject = stream;
            await this.video.play();

            // Set canvas size
            this.canvas.width = 640;
            this.canvas.height = 480;

            console.log('✅ Camera started');

            // Create detector (lightweight model)
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig = {
                runtime: 'tfjs',
                modelType: 'lite',
                maxHands: 1
            };

            this.model = await handPoseDetection.createDetector(model, detectorConfig);
            console.log('✅ Hand detector loaded');

            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            alert(`Camera error: ${error.message}`);
            return false;
        }
    }

    async detectHands() {
        if (!this.active || !this.model) return;

        try {
            // Detect hands
            const hands = await this.model.estimateHands(this.video);

            // Clear canvas
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Draw video
            this.canvasCtx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            if (hands && hands.length > 0) {
                const hand = hands[0];

                // Draw hand
                this.drawHand(hand);

                // Calculate orientation
                const orientation = this.calculateOrientation(hand.keypoints);

                // Update display
                this.updateDisplay(orientation);

                // Send to Spot
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
            }
        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue loop
        this.animationFrame = requestAnimationFrame(() => this.detectHands());
    }

    drawHand(hand) {
        const keypoints = hand.keypoints;

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
        this.canvasCtx.lineWidth = 3;

        connections.forEach(([i, j]) => {
            const start = keypoints[i];
            const end = keypoints[j];
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(start.x, start.y);
            this.canvasCtx.lineTo(end.x, end.y);
            this.canvasCtx.stroke();
        });

        // Draw keypoints
        keypoints.forEach((point, i) => {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            this.canvasCtx.fillStyle = '#00ff88';
            this.canvasCtx.fill();
            this.canvasCtx.strokeStyle = '#fff';
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.stroke();

            // Label key points
            if ([0, 5, 9, 13, 17].includes(i)) {
                this.canvasCtx.fillStyle = '#fff';
                this.canvasCtx.font = 'bold 14px Arial';
                this.canvasCtx.fillText(i, point.x + 12, point.y - 8);
            }
        });
    }

    calculateOrientation(keypoints) {
        // Wrist and key points
        const wrist = keypoints[0];
        const indexBase = keypoints[5];
        const pinkyBase = keypoints[17];
        const middleTip = keypoints[12];

        // Roll: hand tilt left/right
        const roll = Math.atan2(pinkyBase.y - indexBase.y, pinkyBase.x - indexBase.x);

        // Pitch: hand tilt forward/back (using z if available)
        const pitch = (indexBase.y - wrist.y) / 200 * this.sensitivity;

        // Yaw: hand rotation
        const yaw = (middleTip.x - wrist.x) / 200 * this.sensitivity;

        return {
            roll: Math.max(-0.3, Math.min(0.3, roll * this.sensitivity)),
            pitch: Math.max(-0.3, Math.min(0.3, pitch)),
            yaw: Math.max(-0.3, Math.min(0.3, yaw)),
            height: 0
        };
    }

    updateDisplay(orientation) {
        this.rollText.textContent = (orientation.roll * 180 / Math.PI).toFixed(1) + '°';
        this.pitchText.textContent = (orientation.pitch * 180 / Math.PI).toFixed(1) + '°';
        this.yawText.textContent = (orientation.yaw * 180 / Math.PI).toFixed(1) + '°';
    }

    async sendToSpot(orientation) {
        try {
            console.log('Sending:', orientation);
            const response = await fetch('/api/command/body-pose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orientation)
            });
            const result = await response.json();
            if (!result.ok) {
                console.error('Spot error:', result.error);
            }
        } catch (error) {
            console.error('Send error:', error);
        }
    }

    async start() {
        if (this.active) return;

        const initialized = await this.initialize();
        if (!initialized) return;

        this.active = true;
        this.detectHands();
    }

    stop() {
        this.active = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }

        // Reset
        this.sendToSpot({ roll: 0, pitch: 0, yaw: 0, height: 0 });

        this.statusText.textContent = 'Hand control disabled';
        this.statusText.style.color = '#666';
    }

    setSensitivity(value) {
        this.sensitivity = value;
    }
}

window.handControl = new HandControlTF();
console.log('TensorFlow Handpose ready');
