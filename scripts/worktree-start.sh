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

# Install dependencies first
echo "Running pnpm install..."
pnpm install

# Initialise (idempotent — safe to call even if already initialised)
"${SCRIPT_DIR}/worktree-init.sh"

# Start mprocs (blocking — this script stays alive until mprocs exits)
"${SCRIPT_DIR}/mprocs.sh"
