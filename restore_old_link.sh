#!/bin/bash
pkill -9 -f expo || true
pkill -9 -f ngrok || true
pkill -9 -f node || true
sleep 1

# Restore the old randomness
cat > /home/hwi/challenge-app/.expo/settings.json <<EOF
{
  "urlRandomness": "yxxx0xi"
}
EOF

cd /home/hwi/challenge-app
export CI=true
nohup npx expo start --tunnel > expo_restore_link.log 2>&1 &
sleep 20

# Confirm URL
URL=$(curl -s http://localhost:4040/api/tunnels | grep -oE 'exp://yxxx0xi-phsang-8081\.exp\.direct')
echo "RESTORED_URL:$URL"
