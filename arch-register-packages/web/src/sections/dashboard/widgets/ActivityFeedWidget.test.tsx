import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';

const useAuditLogMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../../hooks/useAudit', () => ({
  useAuditLog: (...args: unknown[]) => useAuditLogMock(...args)
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaceSlug: 'workspace-1',
    permissions: { canViewAudit: true }
  })
}));

const { ActivityFeedWidget } = await import('./ActivityFeedWidget');

const makeEntry = (
  entityType: AuditLogEntry['entity_type'],
  operation: AuditLogEntry['operation'] = 'create'
): AuditLogEntry => ({
  id: `${entityType}-1`,
  workspace: 'workspace-1',
  timestamp: '2026-07-29T12:00:00.000Z',
  user_id: 'user-1',
  user_display_name: 'Test user',
  operation,
  entity_type: entityType,
  entity_id: `${entityType}-internal-1`,
  public_id: null,
  entity_name: 'Test activity',
  entity_slug: null,
  schema_id: null,
  changes: {},
  metadata: {}
});

describe('ActivityFeedWidget', () => {
  it.each([
    ['assessment', 'assessment'],
    ['assessment_response', 'assessment response'],
    ['project_milestone', 'milestone'],
    ['automation_note', 'automation note']
  ] as const)('renders the canonical label for %s entries', (entityType, label) => {
    useAuditLogMock.mockReturnValue({
      data: [makeEntry(entityType)],
      isLoading: false
    });

    const markup = renderToStaticMarkup(<ActivityFeedWidget config={{}} />);

    expect(markup).toContain(label);
    if (label !== entityType) expect(markup).not.toContain(entityType);
  });

  it('renders canonical operation labels', () => {
    useAuditLogMock.mockReturnValue({
      data: [makeEntry('entity', 'update'), makeEntry('project', 'delete')],
      isLoading: false
    });

    const markup = renderToStaticMarkup(<ActivityFeedWidget config={{}} />);

    expect(markup).toContain('updated');
    expect(markup).toContain('deleted');
  });
});
