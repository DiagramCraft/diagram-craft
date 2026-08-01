import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// `db.audit.listAuditLogs()` returns raw, unredacted audit rows (including restricted field-group
// values in `changes`). Only the files below are allowed to call it directly:
//  - auditOperations.ts, which always redacts via `redactAuditEntryChanges` before returning
//    (`listAuditLog`), or strips `changes` immediately via `stripAuditChanges` (`getAuditStats`)
//  - workspaceAnalyticsOperations.ts, which strips `changes` immediately via `stripAuditChanges`
//  - the DB contract test, which asserts raw DB-layer behavior
//
// If this test fails because a new call site appeared, don't just add it to the allowlist: make
// sure the new consumer either redacts via `redactAuditEntryChanges` or strips `changes` via
// `stripAuditChanges` before the raw rows go anywhere else, then update the allowlist deliberately.
const ALLOWED_CALL_SITES = new Set([
  'domain/audit/auditOperations.ts',
  'domain/analytics/workspaceAnalyticsOperations.ts',
  'db/contract-tests/audit.contract.test.ts'
]);

const SRC_ROOT = join(__dirname, '..', '..');

const walk = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
};

describe('audit log access boundary', () => {
  it('only allows sanctioned files to call db.audit.listAuditLogs directly', () => {
    const callSitePattern = /\.audit\.listAuditLogs\(/;
    const offenders: string[] = [];

    const selfPath = relative(SRC_ROOT, __filename).split('\\').join('/');

    for (const file of walk(SRC_ROOT)) {
      const relPath = relative(SRC_ROOT, file).split('\\').join('/');
      if (relPath === selfPath) continue;
      if (ALLOWED_CALL_SITES.has(relPath)) continue;

      const content = readFileSync(file, 'utf-8');
      if (callSitePattern.test(content)) {
        offenders.push(relPath);
      }
    }

    expect(
      offenders,
      'Unexpected new caller(s) of db.audit.listAuditLogs — see comment at top of this test'
    ).toEqual([]);
  });
});
