#!/usr/bin/env bash
# worktree-init.sh
# Initialises a git worktree for diagram-craft development:
#   - Prunes registry entries for worktrees that no longer exist on disk
#   - Allocates a unique port block
#   - Registers the worktree in the main tree's .worktrees/registry.json
#   - Writes mprocs.local.yaml, Arch Register server/job-server .env files, and AR web .env
#
# Usage: ./scripts/worktree-init.sh
# Must be run from within the worktree root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# 1. Resolve the main (primary) working tree path
# ---------------------------------------------------------------------------
MAIN_TREE="$(git -C "${WORKTREE_ROOT}" worktree list --porcelain | awk '/^worktree/{p=$2} /^branch/{if(!found){print p; found=1}}')"

if [ -z "${MAIN_TREE}" ]; then
  echo "ERROR: Could not determine the main working tree path." >&2
  exit 1
fi

# Verify we are NOT in the main tree
if [ "${WORKTREE_ROOT}" = "${MAIN_TREE}" ]; then
  echo "ERROR: worktree-init.sh must be run from a worktree, not the main working tree." >&2
  echo "       Main tree: ${MAIN_TREE}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Link shared folders from the main tree into this worktree (always runs)
# ---------------------------------------------------------------------------
LINK_TARGETS=(
  "packages/main/public/diagrams"
  "packages/main/public/img"
  "packages/main/public/stencils"
  ".claude"
  ".codex"
  ".local"
  ".bob"
  "AGENTS.md"
  "CLAUDE.md"
)

for rel in "${LINK_TARGETS[@]}"; do
  src="${MAIN_TREE}/${rel}"
  dst="${WORKTREE_ROOT}/${rel}"
  if [ -e "${src}" ] || [ -L "${src}" ]; then
    mkdir -p "$(dirname "${dst}")"
    ln -sfn "${src}" "${dst}"
  fi
done

# ---------------------------------------------------------------------------
# 3. Ensure the local job-server environment exists
# ---------------------------------------------------------------------------
JOB_SERVER_DIR="${WORKTREE_ROOT}/arch-register-packages/job-server"
JOB_SERVER_ENV="${JOB_SERVER_DIR}/.env"

if [ ! -f "${JOB_SERVER_ENV}" ]; then
  mkdir -p "${JOB_SERVER_DIR}"
  cat >"${JOB_SERVER_ENV}" <<EOF
JOB_SERVER_ALLOW_SQLITE=true
DB_DRIVER=sqlite
SQLITE_PATH=../server/data/arch-register.sqlite
JOB_SERVER_MAX_CONCURRENCY=2
EOF
fi

# ---------------------------------------------------------------------------
# 4. Idempotency guard — if already initialised, print info and exit cleanly
# ---------------------------------------------------------------------------
if [ -f "${WORKTREE_ROOT}/mprocs.local.yaml" ]; then
  echo "This worktree is already initialised."
  echo ""
  echo "  mprocs.local.yaml : ${WORKTREE_ROOT}/mprocs.local.yaml"

  REGISTRY="${MAIN_TREE}/.worktrees/registry.json"
  if [ -f "${REGISTRY}" ]; then
    EXISTING_INDEX="$(python3 -c "
import json
reg = json.load(open('${REGISTRY}'))
entry = next((e for e in reg.get('worktrees', []) if e['path'] == '${WORKTREE_ROOT}'), None)
print(entry['index'] if entry else '')
" 2>/dev/null || true)"
    if [ -n "${EXISTING_INDEX}" ]; then
      EXISTING_WEBHOOK_PORT=$((7000 + EXISTING_INDEX * 10 + 8))
      python3 - <<PYEOF
import json

registry_path = '${REGISTRY}'
reg = json.load(open(registry_path))
for entry in reg.get('worktrees', []):
    if entry['path'] == '${WORKTREE_ROOT}':
        entry.setdefault('ports', {})['webhook_test'] = ${EXISTING_WEBHOOK_PORT}
with open(registry_path, 'w') as f:
    json.dump(reg, f, indent=2)
    f.write('\n')
PYEOF
      if ! grep -q 'Webhook test :' "${WORKTREE_ROOT}/mprocs.local.yaml"; then
        python3 - <<PYEOF
from pathlib import Path

path = Path('${WORKTREE_ROOT}/mprocs.local.yaml')
text = path.read_text()
process = '''  "Webhook test :${EXISTING_WEBHOOK_PORT}":
    shell: |
      PORT=${EXISTING_WEBHOOK_PORT} pnpm --filter @arch-register/webhook-test-server dev
    autostart: false
    stop: SIGTERM
    log:
      file: webhook-test.log

'''
path.write_text(text.replace('proc_log:\n', process + 'proc_log:\n', 1))
PYEOF
        echo "  Added webhook test server on port ${EXISTING_WEBHOOK_PORT}."
      fi
    fi
    ENTRY="$(python3 -c "
import json, sys
reg = json.load(open('${REGISTRY}'))
for e in reg.get('worktrees', []):
    if e['path'] == '${WORKTREE_ROOT}':
        print('  Branch            :', e['branch'])
        print('  Index             :', e['index'])
        print('  Created           :', e['created'])
        p = e['ports']
        print('  Ports             : dc_web={dc_web}  dc_server={dc_server}  ar_web={ar_web}  ar_server={ar_server}  webhook_test={webhook_test}'.format(**p))
        break
" 2>/dev/null || true)"
    [ -n "${ENTRY}" ] && echo "${ENTRY}"
  fi

  # Bootstrap DB if it was deleted (safe to re-run; only seeds when DB is absent)
  AR_SERVER_DIR="${WORKTREE_ROOT}/arch-register-packages/server"
  AR_DB_PATH="${AR_SERVER_DIR}/data/arch-register.sqlite"
  if [ ! -f "${AR_DB_PATH}" ]; then
    echo ""
    echo "Bootstrapping AR server database..."
    mkdir -p "${AR_SERVER_DIR}/data"
    (cd "${AR_SERVER_DIR}" && pnpm bootstrap)
    echo "AR server database bootstrapped."
  fi

  exit 0
fi

# ---------------------------------------------------------------------------
# 5. Ensure registry directory and file exist in the main tree
# ---------------------------------------------------------------------------
REGISTRY_DIR="${MAIN_TREE}/.worktrees"
REGISTRY="${REGISTRY_DIR}/registry.json"

mkdir -p "${REGISTRY_DIR}"

if [ ! -f "${REGISTRY}" ]; then
  echo '{"worktrees":[]}' >"${REGISTRY}"
fi

# ---------------------------------------------------------------------------
# 6. Prune registry entries for worktrees that no longer exist on disk
# ---------------------------------------------------------------------------
PRUNED="$(
  python3 - <<PYEOF
import json, os

registry_path = '${REGISTRY}'
reg = json.load(open(registry_path))

before = len(reg.get('worktrees', []))
reg['worktrees'] = [e for e in reg.get('worktrees', []) if os.path.isdir(e['path'])]
after = len(reg['worktrees'])

if before != after:
    with open(registry_path, 'w') as f:
        json.dump(reg, f, indent=2)
        f.write('\n')
    print(before - after)
else:
    print(0)
PYEOF
)"

if [ "${PRUNED}" -gt 0 ]; then
  echo "Pruned ${PRUNED} stale registry $([ "${PRUNED}" -eq 1 ] && echo entry || echo entries)."
fi

# ---------------------------------------------------------------------------
# 7. Determine the current branch name
# ---------------------------------------------------------------------------
BRANCH="$(git -C "${WORKTREE_ROOT}" symbolic-ref --short HEAD 2>/dev/null || git -C "${WORKTREE_ROOT}" rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
# 8. Find the next free index
# ---------------------------------------------------------------------------
NEXT_INDEX="$(python3 -c "
import json
reg = json.load(open('${REGISTRY}'))
existing = [e['index'] for e in reg.get('worktrees', [])]
print(max(existing, default=0) + 1)
")"

# ---------------------------------------------------------------------------
# 9. Compute port block
# ---------------------------------------------------------------------------
BASE=$((7000 + NEXT_INDEX * 10))
PORT_DC_WEB=$((BASE + 1))
PORT_DC_SERVER=$((BASE + 2))
PORT_AR_WEB=$((BASE + 3))
PORT_AR_SERVER=$((BASE + 4))
PORT_SB_DC=$((BASE + 5))
PORT_SB_AR=$((BASE + 6))
PORT_DOCS=$((BASE + 7))
PORT_WEBHOOK_TEST=$((BASE + 8))

# ---------------------------------------------------------------------------
# 10. Append entry to registry
# ---------------------------------------------------------------------------
TODAY="$(date +%Y-%m-%d)"

python3 - <<PYEOF
import json

registry_path = '${REGISTRY}'
reg = json.load(open(registry_path))

entry = {
    "index":    ${NEXT_INDEX},
    "path":     "${WORKTREE_ROOT}",
    "branch":   "${BRANCH}",
    "created":  "${TODAY}",
    "ports": {
        "dc_web":       ${PORT_DC_WEB},
        "dc_server":    ${PORT_DC_SERVER},
        "ar_web":       ${PORT_AR_WEB},
        "ar_server":    ${PORT_AR_SERVER},
        "storybook_dc": ${PORT_SB_DC},
        "storybook_ar": ${PORT_SB_AR},
        "docs":         ${PORT_DOCS},
        "webhook_test": ${PORT_WEBHOOK_TEST}
    },
    "database": "sqlite://./data/arch-register.sqlite"
}

reg['worktrees'].append(entry)

with open(registry_path, 'w') as f:
    json.dump(reg, f, indent=2)
    f.write('\n')

print("Registry updated:", registry_path)
PYEOF

# ---------------------------------------------------------------------------
# 11. Write mprocs.local.yaml
# ---------------------------------------------------------------------------
BOOTSTRAP_DATA="${MAIN_TREE}/packages/main/public/data/dataset1/data.json"
BOOTSTRAP_SCHEMAS="${MAIN_TREE}/packages/main/public/data/dataset1/schemas.json"

cat >"${WORKTREE_ROOT}/mprocs.local.yaml" <<EOF
procs:
  "DC web :${PORT_DC_WEB}":
    shell: |
      PORT=${PORT_DC_WEB} pnpm client:dev
    autostart: false
    stop: SIGKILL
    log:
      file: dc-web.log
  "DC server :${PORT_DC_SERVER}":
    shell: |
      cd packages/server-main && \\
      PORT=${PORT_DC_SERVER} pnpm run dev --data-dir ./data --fs-root ../main/public --bootstrap-data ${BOOTSTRAP_DATA} --bootstrap-schemas ${BOOTSTRAP_SCHEMAS}
    autostart: false
    stop: SIGKILL
    log:
      file: dc-server.log
  "AR web :${PORT_AR_WEB}":
    shell: |
      cd arch-register-packages/web && \\
      PORT=${PORT_AR_WEB} pnpm dev
    autostart: false
    stop: SIGKILL
    log:
      file: ar-web.log
  "AR server :${PORT_AR_SERVER}":
    shell: |
      cd arch-register-packages/server && \\
      PORT=${PORT_AR_SERVER} pnpm dev
    autostart: false
    stop: SIGKILL
    log:
      file: ar-server.log
  "AR job server":
    shell: |
      cd arch-register-packages/job-server && \\
      JOB_SERVER_ID=worktree-${NEXT_INDEX} \\
      JOB_SERVER_NAME="Worktree ${NEXT_INDEX} job server" \\
      pnpm dev
    autostart: false
    stop: SIGTERM
    log:
      file: ar-job-server.log

  "Webhook test :${PORT_WEBHOOK_TEST}":
    shell: |
      PORT=${PORT_WEBHOOK_TEST} pnpm --filter @arch-register/webhook-test-server dev
    autostart: false
    stop: SIGTERM
    log:
      file: webhook-test.log

  "Storybook :${PORT_SB_DC}":
    cwd: "packages/main"
    shell: |
      pnpm storybook --port ${PORT_SB_DC}
    autostart: false
    stop: SIGKILL
    log:
      file: storybook.log

  "AR Storybook :${PORT_SB_AR}":
    cwd: "arch-register-packages/web"
    shell: |
      pnpm storybook --port ${PORT_SB_AR}
    autostart: false
    stop: SIGKILL
    log:
      file: ar-storybook.log

  "Docs :${PORT_DOCS}":
    shell: |
      pnpm docs:dev --port ${PORT_DOCS} --no-open
    autostart: false
    stop: SIGKILL
    log:
      file: docs.log

proc_log:
  dir: .logs
  mode: truncate
EOF

# ---------------------------------------------------------------------------
# 12. Write packages/main/.env
# ---------------------------------------------------------------------------
DC_WEB_ENV="${WORKTREE_ROOT}/packages/main/.env"

cat >"${DC_WEB_ENV}" <<EOF
VITE_DC_SERVER_PORT=${PORT_DC_SERVER}
EOF

# ---------------------------------------------------------------------------
# 14. Write arch-register-packages/server/.env
# ---------------------------------------------------------------------------
AR_SERVER_ENV="${WORKTREE_ROOT}/arch-register-packages/server/.env"

cat >"${AR_SERVER_ENV}" <<EOF
DB_DRIVER=sqlite
SQLITE_PATH=./data/arch-register.sqlite
AUTH_MODE=local
JWT_SECRET=your-secret-key-here-min-32-characters-required
EOF

# ---------------------------------------------------------------------------
# 15. Bootstrap AR server database (SQLite, first run only)
# ---------------------------------------------------------------------------
AR_SERVER_DIR="${WORKTREE_ROOT}/arch-register-packages/server"
AR_DB_PATH="${AR_SERVER_DIR}/data/arch-register.sqlite"

if [ ! -f "${AR_DB_PATH}" ]; then
  echo "Bootstrapping AR server database..."
  mkdir -p "${AR_SERVER_DIR}/data"
  (cd "${AR_SERVER_DIR}" && pnpm bootstrap)
  echo "AR server database bootstrapped."
fi

# ---------------------------------------------------------------------------
# 16. Write arch-register-packages/web/.env
# ---------------------------------------------------------------------------
AR_WEB_ENV="${WORKTREE_ROOT}/arch-register-packages/web/.env"

cat >"${AR_WEB_ENV}" <<EOF
VITE_AR_SERVER_PORT=${PORT_AR_SERVER}
EOF

# ---------------------------------------------------------------------------
# 16. Print summary
# ---------------------------------------------------------------------------
echo ""
echo "Worktree initialised"
echo "  Branch      : ${BRANCH}"
echo "  Index       : ${NEXT_INDEX}"
echo "  Created     : ${TODAY}"
echo ""
echo "  Service          Port"
echo "  ─────────────────────────"
printf "  DC web           %s\n" "${PORT_DC_WEB}"
printf "  DC server        %s\n" "${PORT_DC_SERVER}"
printf "  AR web           %s\n" "${PORT_AR_WEB}"
printf "  AR server        %s\n" "${PORT_AR_SERVER}"
printf "  AR job server    local SQLite worker\n"
printf "  Storybook DC     %s\n" "${PORT_SB_DC}"
printf "  Storybook AR     %s\n" "${PORT_SB_AR}"
printf "  Docs             %s\n" "${PORT_DOCS}"
printf "  Webhook test     %s\n" "${PORT_WEBHOOK_TEST}"
echo ""
echo "  Database    : SQLite (./data/arch-register.sqlite)"
echo "  Registry    : ${REGISTRY}"
echo ""
echo "Run './scripts/worktree-start.sh' to start all services."
