import { describe, expect, it } from 'vitest';
import type { Workspace } from '@arch-register/api-types/workspaceContract';
import { firstAvailableWorkspace } from './DangerZoneSubSection';

const workspace = (id: string, url_slug: string) => ({ id, url_slug }) as Workspace;

describe('firstAvailableWorkspace', () => {
  it('returns the first workspace other than the deleted one', () => {
    const workspaces = [workspace('deleted', 'deleted'), workspace('next', 'next-workspace')];

    expect(firstAvailableWorkspace(workspaces, 'deleted')).toBe(workspaces[1]);
  });

  it('returns undefined when no workspace remains', () => {
    expect(firstAvailableWorkspace([workspace('deleted', 'deleted')], 'deleted')).toBeUndefined();
  });
});
