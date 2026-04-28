#!/bin/bash
# start_expo_tunnel.sh
cd /home/hwi/challenge-app
pkill -9 -f expo || true
pkill -9 -f ngrok || true
export CI=true
nohup npx expo start --tunnel > expo_native_tunnel.log 2>&1 &
echo "Started Expo with Native Tunnel"
