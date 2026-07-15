import { describe, expect, it, vi } from 'vitest';
import { auditKeys, invalidateAuditQueries } from '../queries/audit';
import { workspaceAnalyticsKeys } from '../queries/workspaceAnalytics';

describe('auditKeys', () => {
  it('nests log queries under a workspace-scoped prefix', () => {
    expect(auditKeys.log('ws-1', { entityId: 'e-1', limit: 100 })).toEqual([
      'audit',
      'log',
      'ws-1',
      { entityId: 'e-1', limit: 100 }
    ]);
  });
});

describe('invalidateAuditQueries', () => {
  it('invalidates workspace audit logs and stats', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as {
      invalidateQueries: typeof invalidateQueries;
    };

    await invalidateAuditQueries(queryClient as never, 'ws-1');

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: auditKeys.workspaceLogs('ws-1')
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: auditKeys.stats('ws-1')
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: workspaceAnalyticsKeys.workspace('ws-1')
    });
  });
});
