#!/bin/bash
cd /home/hwi/challenge-app
pkill -9 -f expo || true
pkill -9 -f ngrok || true
sleep 1
# Force the old URL segments
cat > .expo/settings.json <<EOF
{
  "urlRandomness": "yxxx0xi"
}
EOF
# Start without CI=true
nohup npx expo start --tunnel --non-interactive > expo_watch_old.log 2>&1 &
echo "Restarted with randomness yxxx0xi"
