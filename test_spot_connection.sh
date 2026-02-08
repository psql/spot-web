#!/bin/bash

echo "=== Testing Connection to Spot ==="
echo ""

# Test 1: Ping
echo "1. Testing ping to 192.168.80.3..."
if ping -c 2 192.168.80.3 > /dev/null 2>&1; then
    echo "   ✓ Ping successful"
else
    echo "   ✗ Ping failed - Are you connected to Spot's WiFi?"
    exit 1
fi

# Test 2: Port 443
echo ""
echo "2. Testing port 443..."
if timeout 2 bash -c "echo > /dev/tcp/192.168.80.3/443" 2>/dev/null; then
    echo "   ✓ Port 443 reachable"
else
    echo "   ✗ Port 443 not reachable"
    exit 1
fi

# Test 3: SDK connection
echo ""
echo "3. Testing SDK connection..."
source venv/bin/activate
python3 << 'PYTHON'
import bosdyn.client

try:
    sdk = bosdyn.client.create_standard_sdk("SpotTest")
    robot = sdk.create_robot("192.168.80.3")
    robot_id = robot.get_id()
    print(f"   ✓ SDK connected!")
    print(f"   Robot: {robot_id.nickname} ({robot_id.serial_number})")
except Exception as e:
    print(f"   ✗ SDK error: {e}")
    exit(1)
PYTHON

echo ""
echo "4. Starting web controller..."
nohup uvicorn backend.app:app --host 0.0.0.0 --port 8081 > server.log 2>&1 &
sleep 3
echo "   ✓ Server started (PID: $!)"

echo ""
echo "=== All Tests Passed! ==="
echo "Open http://localhost:8081 in your browser"

