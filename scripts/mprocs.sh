#!/usr/bin/env bash
# mprocs.sh
# Wrapper around mprocs that uses mprocs.local.yaml when present,
# falling back to the tracked mprocs.yaml otherwise.
#
# Usage: ./scripts/mprocs.sh [mprocs options...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${WORKTREE_ROOT}/mprocs.local.yaml" ]; then
  exec mprocs -c "${WORKTREE_ROOT}/mprocs.local.yaml" "$@"
else
  exec mprocs "$@"
fi
