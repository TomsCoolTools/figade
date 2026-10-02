#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer, then open this file again."
  exit 1
fi
node scripts/serve-built.cjs
