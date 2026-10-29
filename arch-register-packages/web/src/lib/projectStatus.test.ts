import { describe, expect, it } from 'vitest';
import { isArchivedProject } from './projectStatus';

describe('isArchivedProject', () => {
  it('treats complete and cancelled projects as archived', () => {
    expect(isArchivedProject({ status: 'complete' })).toBe(true);
    expect(isArchivedProject({ status: 'cancelled' })).toBe(true);
  });

  it('treats draft, active and missing projects as not archived', () => {
    expect(isArchivedProject({ status: 'draft' })).toBe(false);
    expect(isArchivedProject({ status: 'active' })).toBe(false);
    expect(isArchivedProject(undefined)).toBe(false);
  });
});
