#!/bin/bash
# Agrios auto-deploy script
# Run this from your computer: bash deploy.sh
# Requires: git, node, npm installed

set -e

echo "🌿 Agrios deploy starting..."

# ── FRONTEND ──────────────────────────────────────────────────
echo ""
echo "📦 Deploying frontend to useAgrios..."

# Clone or pull frontend repo
if [ -d "useAgrios" ]; then
  cd useAgrios && git pull origin main
else
  git clone https://github.com/JTOPENTLAB/useAgrios.git
  cd useAgrios
fi

# Copy all frontend files from the outputs folder
# (run this script from the same folder as your downloaded files)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/index.html"     ./index.html
cp "$SCRIPT_DIR/manifest.json"  ./manifest.json
cp "$SCRIPT_DIR/sw.js"          ./sw.js
cp "$SCRIPT_DIR/icon-192.png"   ./icon-192.png
cp "$SCRIPT_DIR/icon-512.png"   ./icon-512.png

git add -A
git commit -m "Agrios v2 — auth, PWA, live API, price fix $(date '+%Y-%m-%d %H:%M')"
git push origin main
echo "✅ Frontend pushed — Netlify will auto-deploy to useagrios.com in ~30s"

cd ..

# ── BACKEND ───────────────────────────────────────────────────
echo ""
echo "📦 Deploying backend to agrios-api..."

if [ -d "agrios-api" ]; then
  cd agrios-api && git pull origin main
else
  git clone https://github.com/JTOPENTLAB/agrios-api.git
  cd agrios-api
fi

cp "$SCRIPT_DIR/priceFetcher.js"  ./agrios-backend/src/services/priceFetcher.js
cp "$SCRIPT_DIR/index_api.js"     ./agrios-backend/src/index.js

git add -A
git commit -m "Fix price drift + CORS — $(date '+%Y-%m-%d %H:%M')"
git push origin main
echo "✅ Backend pushed — Render will auto-deploy agrios-api in ~2 mins"

echo ""
echo "🎉 All done! Check:"
echo "   Frontend: https://useagrios.com"
echo "   API:      https://agrios-api.onrender.com/health"
