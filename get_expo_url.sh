#!/bin/bash
cd /home/hwi/challenge-app
pkill -9 -f expo || true
export CI=true
npx expo start --tunnel > expo_url_capture.log 2>&1 &
PID=$!
sleep 20
URL=$(grep -oE 'exp://[a-zA-Z0-9.-]+\.exp\.direct[a-zA-Z0-9./?=&-]*' expo_url_capture.log | tail -n 1)
if [ -z "$URL" ]; then
  # Try another way to find it
  URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.exp\.direct' expo_url_capture.log | sed 's/https/exp/' | tail -n 1)
fi
echo "FOUND_URL:$URL"
