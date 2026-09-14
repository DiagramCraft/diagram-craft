#!/usr/bin/env bash

set -euo pipefail

# Parse arguments
USE_POSTGRES=false
RUN_ALL=false
SKIP_LINT=false
UI_TEST_COMMAND="test:ui:full"

for arg in "$@"; do
  case $arg in
    --postgres)
      USE_POSTGRES=true
      ;;
    --all)
      RUN_ALL=true
      ;;
    --nolint)
      SKIP_LINT=true
      ;;
    --quick)
      UI_TEST_COMMAND="test:ui:quick"
      ;;
  esac
done

configure_postgres() {
  echo "Running tests with PostgreSQL..."
  export E2E_DB_DRIVER=postgres
  if [ -z "${DATABASE_URL:-}" ]; then
    export DATABASE_URL=postgresql://local:local@localhost:5432/artest
  fi
  USE_POSTGRES=true
}

configure_sqlite() {
  echo "Running tests with SQLite..."
  unset E2E_DB_DRIVER
  unset DATABASE_URL
  USE_POSTGRES=false
}

# Set up the selected database configuration before running any database-aware
# suites. The default is SQLite; use --postgres to opt into PostgreSQL.
if [ "$RUN_ALL" = false ] && [ "$USE_POSTGRES" = true ]; then
  configure_postgres
elif [ "$RUN_ALL" = false ]; then
  configure_sqlite
fi

export NODE_NO_WARNINGS=1

# Progress reporting via the ConEmu OSC extension (also understood by
# Ghostty and Windows Terminal): https://ghostty.org/docs/vt/osc/conemu
# Each call to run_step counts as one process call towards TOTAL_STEPS.
SHARED_STEPS=1
if [ "$SKIP_LINT" = false ]; then
  SHARED_STEPS=3
fi
E2E_SUITE_STEPS=2
if [ "$RUN_ALL" = true ]; then
  TOTAL_STEPS=$((SHARED_STEPS + 1 + E2E_SUITE_STEPS + E2E_SUITE_STEPS))
else
  TOTAL_STEPS=$((SHARED_STEPS + 1 + E2E_SUITE_STEPS))
fi
STEP_COUNT=0

report_progress() {
  local pct=$((STEP_COUNT * 100 / TOTAL_STEPS))
  printf '\033]9;4;1;%d\a' "$pct"
}

report_error() {
  local pct=$((STEP_COUNT * 100 / TOTAL_STEPS))
  printf '\033]9;4;2;%d\a' "$pct"
}
trap report_error ERR

run_step() {
  local desc="$1"
  shift
  STEP_COUNT=$((STEP_COUNT + 1))
  echo "[$STEP_COUNT/$TOTAL_STEPS] $desc"
  "$@"
  report_progress
}

run_e2e_api_tests() {
  if [ "$USE_POSTGRES" = true ]; then
    # Each API test file provisions and drops its own PostgreSQL schema. Run
    # those files serially to avoid concurrent DDL and connection spikes.
    run_step "Running Arch Register API suite with PostgreSQL..." \
      pnpm --filter @arch-register/e2e exec vitest run --no-file-parallelism
  else
    run_step "Running Arch Register API suite with SQLite..." \
      pnpm --filter @arch-register/e2e test:api
  fi
}

run_database_contract_tests() {
  if [ "$USE_POSTGRES" = true ]; then
    run_step "Running Arch Register DB contract suite with SQLite and PostgreSQL..." \
      pnpm --filter @arch-register/server test:db-contract
  else
    run_step "Running Arch Register DB contract suite with SQLite..." \
      pnpm --filter @arch-register/server test:db-contract
  fi
}

run_e2e_ui_tests() {
  if [ "$USE_POSTGRES" = true ]; then
    run_step "Running Arch Register UI suite with PostgreSQL: $UI_TEST_COMMAND" \
      pnpm --filter @arch-register/e2e "$UI_TEST_COMMAND"
  else
    run_step "Running Arch Register UI suite with SQLite: $UI_TEST_COMMAND" \
      pnpm --filter @arch-register/e2e "$UI_TEST_COMMAND"
  fi
}

run_e2e_suite() {
  run_e2e_api_tests
  run_e2e_ui_tests
}

# Run shared tests once, with or without lint.
echo "Running shared database-independent checks..."
if [ "$SKIP_LINT" = false ]; then
  run_step "Checking formatting..." pnpm format:check
  run_step "Running lint..." pnpm lint
  run_step "Running shared tests..." pnpm test
else
  echo "Skipping lint step..."
  run_step "Running shared tests..." pnpm test
fi

if [ "$RUN_ALL" = true ]; then
  # The contract harness runs both drivers when DATABASE_URL is set. Run it
  # once, then run the API and UI suites in explicit SQLite/PostgreSQL order.
  configure_postgres
  run_database_contract_tests

  configure_sqlite
  run_e2e_suite

  configure_postgres
  run_e2e_suite
else
  run_database_contract_tests
  run_e2e_suite
fi

# Clear the taskbar progress indicator now that everything succeeded.
printf '\033]9;4;0;0\a'
echo "All tests completed successfully!"
