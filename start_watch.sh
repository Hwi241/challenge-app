#!/bin/bash
# start_watch.sh
cd /home/hwi/challenge-app
pkill -9 -f expo || true
pkill -9 -f ngrok || true
# fuser -k 8081/tcp || true
sleep 1
# Start Expo without CI=true to enable Watch Mode/Fast Refresh
nohup npx expo start --tunnel --clear --non-interactive > expo_watch.log 2>&1 &
echo "Expo started in watch mode"
