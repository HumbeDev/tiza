#!/usr/bin/env bash
# Publishes a new version: bumps the version everywhere, commits, tags and pushes.
# GitHub Actions (.github/workflows/release.yml) then builds the installers.
#
#   scripts/release.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Uso: scripts/release.sh X.Y.Z   (versión actual: $(node -p "require('./package.json').version"))"
  exit 1
fi
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "❌ Publica desde main (estás en $(git branch --show-current))."
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "❌ Hay cambios sin commitear."
  exit 1
fi
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "❌ La etiqueta v$VERSION ya existe."
  exit 1
fi

echo "🔖 Versión $VERSION"
npm version "$VERSION" --no-git-tag-version >/dev/null
sed -i.bak -E "0,/^version = \".*\"/s//version = \"$VERSION\"/" src-tauri/Cargo.toml && rm src-tauri/Cargo.toml.bak
node -e '
  const fs = require("fs"), p = "src-tauri/tauri.conf.json";
  const c = JSON.parse(fs.readFileSync(p, "utf8"));
  c.version = process.argv[1];
  fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
' "$VERSION"
(cd src-tauri && cargo update -p tiza --offline >/dev/null 2>&1 || cargo check -q)

git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -q -m "chore: release v$VERSION"
git tag -a "v$VERSION" -m "Tiza v$VERSION"

read -r -p "¿Subir main y la etiqueta v$VERSION a GitHub? [s/N] " answer
if [[ "$answer" =~ ^[sSyY]$ ]]; then
  git push origin main "v$VERSION"
  echo "✅ Listo. Los instaladores se compilan en: https://github.com/HumbeDev/tiza/actions"
  echo "   y aparecerán en: https://github.com/HumbeDev/tiza/releases/tag/v$VERSION"
else
  echo "Sin subir. Para publicar después: git push origin main v$VERSION"
fi
