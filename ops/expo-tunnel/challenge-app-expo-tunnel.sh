#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/hwi/challenge-app"

cd "$PROJECT_DIR"

exec npx expo start --tunnel
