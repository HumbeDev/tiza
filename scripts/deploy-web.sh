#!/usr/bin/env bash
# Builds the web version of Tiza and uploads it to Hostinger:
# https://tiza.ingenieriafisica.online/
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE=u934490983@82.25.67.11
PORT=65002
REMOTE_DIR=/home/u934490983/domains/ingenieriafisica.online/public_html/tiza/

echo "🚀 Construyendo la versión web..."
npm run build

echo "📤 Subiendo a Hostinger..."
ssh -p "$PORT" "$REMOTE" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh -p $PORT" dist/ "$REMOTE:$REMOTE_DIR"

echo "✅ ¡Publicado! https://tiza.ingenieriafisica.online/  ($(git rev-parse --short HEAD))"
