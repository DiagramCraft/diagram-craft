#!/usr/bin/env bash
# worktree-start.sh
# Initialises the worktree (if not already done) and starts all services via
# mprocs. Stale registry entries from deleted worktrees are pruned automatically
# by worktree-init.sh on each run.
#
# Usage: ./scripts/worktree-start.sh
# Must be run from within the worktree root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load nvm so the correct Node version (from .nvmrc) is used for pnpm install
# and inherited by all child processes (mprocs and its service shells).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" --no-use
if command -v nvm &>/dev/null; then
  nvm use --silent
else
  echo "WARNING: nvm not found — using system Node $(node --version). Expected: $(cat .nvmrc 2>/dev/null || echo unknown)" >&2
fi

# Install dependencies first
echo "Running pnpm install..."
pnpm install

# Initialise (idempotent — safe to call even if already initialised)
"${SCRIPT_DIR}/worktree-init.sh"

# Start mprocs (blocking — this script stays alive until mprocs exits)
"${SCRIPT_DIR}/mprocs.sh"
