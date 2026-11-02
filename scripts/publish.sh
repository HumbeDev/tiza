#!/usr/bin/env bash
# Publishes everything: installers on GitHub Releases (scripts/release.sh) and the web
# version on tiza.ingenieriafisica.online (scripts/deploy-web.sh).
#
#   scripts/publish.sh 0.3.0
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${1:-}" ]]; then
  echo "Uso: scripts/publish.sh X.Y.Z"
  exit 1
fi

echo "🧪 Verificando antes de publicar..."
npm run lint
npm test
(cd src-tauri && cargo test --quiet)

scripts/release.sh "$1"
scripts/deploy-web.sh
