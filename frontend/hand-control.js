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
        console.log('Initializing hand tracking...');
        console.log('MediaPipe Hands available:', !!window.Hands);
        console.log('Camera utils available:', !!window.Camera);

        if (!window.Hands) {
            console.error('MediaPipe Hands not loaded from CDN');
            alert('MediaPipe libraries not loaded. Check internet connection.');
            return false;
        }

        if (!window.Camera) {
            console.error('Camera utils not loaded from CDN');
            alert('Camera utilities not loaded. Check internet connection.');
            return false;
        }

        try {
            // Test camera access first
            console.log('Requesting camera access...');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('✅ Camera access granted!');
            stream.getTracks().forEach(track => track.stop()); // Stop test stream

            // Initialize MediaPipe Hands
            console.log('Creating MediaPipe Hands instance...');
            this.hands = new Hands({
                locateFile: (file) => {
                    console.log('Loading MediaPipe file:', file);
                    return `/mediapipe/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 0,  // 0 = lite (fastest)
                minDetectionConfidence: 0.3,  // Lower = faster
                minTrackingConfidence: 0.3,
                selfieMode: false
            });

            this.hands.onResults((results) => this.onResults(results));

            // Start camera
            console.log('Starting camera...');
            // Ultra-low res + aggressive frame skipping
            let frameCount = 0;
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.hands && this.active) {
                        // Process every 3rd frame (3x faster!)
                        if (frameCount++ % 3 === 0) {
                            await this.hands.send({ image: this.video });
                        }
                    }
                },
                width: 320,  // Very low res for speed
                height: 240
            });

            await this.camera.start();
            console.log('✅ Camera started!');

            // Set canvas size to match video
            this.canvas.width = 320;
            this.canvas.height = 240;

            return true;
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            console.error('Error details:', error.message, error.name);

            if (error.name === 'NotAllowedError') {
                alert('Camera access denied. Please allow camera access in browser settings.');
            } else if (error.name === 'NotFoundError') {
                alert('No camera found. Please connect a webcam.');
            } else {
                alert(`Hand tracking error: ${error.message}`);
            }

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
        this.canvasCtx.lineWidth = 3;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.canvasCtx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.canvasCtx.stroke();
        });

        // Draw points with labels
        landmarks.forEach((landmark, i) => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            // Draw point
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
            this.canvasCtx.fillStyle = '#00ff88';
            this.canvasCtx.fill();
            this.canvasCtx.strokeStyle = '#fff';
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.stroke();

            // Draw landmark numbers for key points
            if ([0, 5, 9, 13, 17].includes(i)) { // Wrist and finger bases
                this.canvasCtx.fillStyle = '#fff';
                this.canvasCtx.font = 'bold 12px Arial';
                this.canvasCtx.fillText(i, x + 10, y - 10);
            }
        });

        // Draw orientation indicators
        const wrist = landmarks[0];
        const middleBase = landmarks[9];
        const wristX = wrist.x * this.canvas.width;
        const wristY = wrist.y * this.canvas.height;

        // Draw roll indicator (horizontal line)
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(wristX - 40, wristY);
        this.canvasCtx.lineTo(wristX + 40, wristY);
        this.canvasCtx.strokeStyle = '#ff4444';
        this.canvasCtx.lineWidth = 3;
        this.canvasCtx.stroke();

        // Draw pitch indicator (vertical line)
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(wristX, wristY - 40);
        this.canvasCtx.lineTo(wristX, wristY + 40);
        this.canvasCtx.strokeStyle = '#00ff88';
        this.canvasCtx.lineWidth = 3;
        this.canvasCtx.stroke();
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
            console.log('Sending hand pose to Spot:', orientation);
            const response = await fetch('/api/command/body-pose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orientation)
            });
            const result = await response.json();
            if (!result.ok) {
                console.error('Spot rejected pose:', result.error);
            }
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
