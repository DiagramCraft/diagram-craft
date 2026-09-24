import { describe, expect, it } from 'vitest';
import type { FieldGroupAccessControl } from '@arch-register/permissions';
import {
  resolveFieldAccess,
  resolveGroupAccessControl,
  type FieldGroupSchemaShape
} from './fieldGroupAccess';

describe('resolveGroupAccessControl', () => {
  const group = { id: 'financials', accessControl: { teamIds: ['team-finance'] } };

  it("falls back to the group's own accessControl when there is no shared-link override", () => {
    expect(resolveGroupAccessControl(group, [])).toEqual({ teamIds: ['team-finance'] });
  });

  it('prefers a matching shared_field_group_links override', () => {
    expect(
      resolveGroupAccessControl(group, [{ groupId: 'financials', teamIds: ['team-ops'] }])
    ).toEqual({ teamIds: ['team-ops'] });
  });

  it('an override link with no teamIds means unrestricted, overriding the group default', () => {
    expect(resolveGroupAccessControl(group, [{ groupId: 'financials' }])).toBeUndefined();
  });

  it('ignores links for other groups', () => {
    expect(
      resolveGroupAccessControl(group, [{ groupId: 'other-group', teamIds: ['team-x'] }])
    ).toEqual({ teamIds: ['team-finance'] });
  });
});

describe('resolveFieldAccess', () => {
  const getFieldGroupAccess = (accessControl: FieldGroupAccessControl | undefined) =>
    accessControl ? 'none' : 'edit';

  it('is unrestricted ("edit") when the field has no groupId', () => {
    const schema: FieldGroupSchemaShape = {};
    expect(resolveFieldAccess(schema, {}, getFieldGroupAccess)).toBe('edit');
  });

  it("uses the group's own accessControl when found on the schema", () => {
    const schema: FieldGroupSchemaShape = {
      groups: [{ id: 'financials', accessControl: { teamIds: ['team-finance'] } }],
      shared_field_group_links: []
    };
    expect(resolveFieldAccess(schema, { groupId: 'financials' }, getFieldGroupAccess)).toBe(
      'none'
    );
  });

  it('applies a shared_field_group_links override before falling back to the group default', () => {
    const schema: FieldGroupSchemaShape = {
      groups: [{ id: 'financials', accessControl: { teamIds: ['team-finance'] } }],
      shared_field_group_links: [{ groupId: 'financials' }]
    };
    expect(resolveFieldAccess(schema, { groupId: 'financials' }, getFieldGroupAccess)).toBe(
      'edit'
    );
  });

  it('treats an unknown groupId (group missing from the schema) as having no accessControl', () => {
    const schema: FieldGroupSchemaShape = { groups: [], shared_field_group_links: [] };
    expect(resolveFieldAccess(schema, { groupId: 'nonexistent' }, getFieldGroupAccess)).toBe(
      'edit'
    );
  });
});
