#!/bin/bash
# start_ngrok.sh

# Move to project directory
cd /home/hwi/challenge-app

# 1. Cleanup existing processes
pkill -9 -f expo || true
pkill -9 -f ngrok || true
(lsof -ti:8081 | xargs kill -9) || true

# 2. Start Expo in background
export CI=true
nohup npx expo start --port 8081 > expo_direct.log 2>&1 &

# 3. Wait for Expo to initialize
sleep 15

# 4. Start ngrok in background
nohup ngrok http 8081 --log=stdout > ngrok_direct.log 2>&1 &

# 5. Signal completion
echo "Server and Tunnel started at $(date)" >> server_start_status.txt
