import { expect, test } from '../helpers/fixtures';

test.describe('shared fieldgroups', () => {
  test('creates a group and includes its fields in a schema', async ({ orpc }) => {
    const group = await orpc.fieldGroups.create({
      params: { workspace: 'default' },
      body: {
        name: 'Security Posture',
        description: 'Common security controls',
        fields: [
          { id: 'security_reviewed', name: 'Security reviewed', type: 'boolean' },
          { id: 'security_notes', name: 'Security notes', type: 'longtext' }
        ]
      }
    });

    expect(group.fields).toHaveLength(2);
    const schema = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: 'Secure Component', shared_field_group_links: [{ groupId: group.id }] }
    });

    expect(schema.shared_field_group_links).toEqual([{ groupId: group.id }]);
    expect(schema.groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: group.id })])
    );
    expect(schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'security_reviewed', groupId: group.id }),
        expect.objectContaining({ id: 'security_notes', groupId: group.id })
      ])
    );

    await expect(
      orpc.fieldGroups.remove({ params: { workspace: 'default', id: group.id } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('updates an included group and recompiles the schema', async ({ orpc }) => {
    const group = await orpc.fieldGroups.create({
      params: { workspace: 'default' },
      body: {
        name: 'Operational Posture',
        fields: [{ id: 'operational_owner', name: 'Operational owner', type: 'text' }]
      }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: 'Operational System', shared_field_group_links: [{ groupId: group.id }] }
    });

    const updated = await orpc.fieldGroups.update({
      params: { workspace: 'default', id: group.id },
      body: {
        name: 'Operational Posture',
        fields: [{ id: 'operational_risk', name: 'Operational risk', type: 'text' }]
      }
    });

    expect(updated.fields[0]).toMatchObject({ id: 'operational_risk' });
    const refreshed = await orpc.schemas.get({ params: { workspace: 'default', id: schema.id } });
    expect(refreshed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'operational_risk', groupId: group.id })
      ])
    );
    expect(refreshed.fields.some(field => field.id === 'operational_owner')).toBe(false);
  });

  test('preserves mixed local and shared fieldgroup ordering', async ({ orpc }) => {
    const shared = await orpc.fieldGroups.create({
      params: { workspace: 'default' },
      body: { name: 'Shared Controls', fields: [{ id: 'control', name: 'Control', type: 'text' }] }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: 'default' },
      body: {
        name: 'Mixed Groups',
        fields: [{ id: 'local_field', name: 'Local field', type: 'text', groupId: 'local-group' }],
        groups: [
          { id: shared.id, name: shared.name },
          { id: 'local-group', name: 'Local group' }
        ],
        shared_field_group_links: [{ groupId: shared.id }]
      }
    });

    expect(schema.groups.map(group => group.id)).toEqual([shared.id, 'local-group']);
  });
});
