#!/bin/bash
pkill -9 -f expo || true
pkill -9 -f ngrok || true
pkill -9 -f metro || true
sleep 2
cd /home/hwi/challenge-app
export CI=true
nohup npx expo start --tunnel > expo_old_link_retry.log 2>&1 &
sleep 20
URL=$(curl -s http://localhost:4041/api/tunnels | grep -oE 'exp://[a-zA-Z0-9.-]+\.exp\.direct')
echo "URL_RESULT:$URL"
