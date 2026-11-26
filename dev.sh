#!/usr/bin/env sh
# Linux/macOS shortcut. The real script is scripts/dev.mjs (works on Windows too).
#   ./dev.sh          -> https://localhost:4200
#   ./dev.sh --lan    -> also reachable from other devices
cd "$(dirname "$0")" && exec node scripts/dev.mjs "$@"
