// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldMigrations, PendingFieldChange } from '@arch-register/api-types/schemaContract';
import {
  useSchemaEditorController,
  type SchemaEditorAdapter,
  type SchemaEditorController
} from './schemaEditorState';

type TestSelected = { id: string; name: string };
type TestField = { id: string; name: string; groupId?: string; type: 'text' | 'number' };
type TestGroup = {
  id: string;
  name: string;
  description?: string;
  accessControl?: { teamIds: string[] };
};
type TestExtra = { marker: string };

const migration: PendingFieldChange = {
  fieldId: 'old_field',
  fieldName: 'Old field',
  kind: 'removed',
  entityCount: 2
};

const selectedA: TestSelected = { id: 'schema-a', name: 'Schema A' };
const selectedB: TestSelected = { id: 'schema-b', name: 'Schema B' };

const makeAdapter = (
  overrides: Partial<
    SchemaEditorAdapter<TestSelected, TestField, TestGroup, TestExtra, 'text' | 'number'>
  > = {}
) => {
  const adapter: SchemaEditorAdapter<
    TestSelected,
    TestField,
    TestGroup,
    TestExtra,
    'text' | 'number'
  > = {
    createDraft: selected => ({
      name: selected.name,
      description: '',
      fields: [{ id: 'title', name: 'Title', type: 'text' }],
      groups: [],
      sharedFieldGroupLinks: [],
      validationRules: [],
      color: null,
      icon: null,
      marker: selected.id
    }),
    createField: (id, groupId) => ({
      id,
      name: 'New field',
      type: 'text',
      ...(groupId ? { groupId } : {})
    }),
    changeFieldType: (field, newType) => ({ ...field, type: newType }),
    save: vi.fn(async (_selected, _draft, _migrations?: FieldMigrations) => undefined),
    create: vi.fn(async () => ({ id: 'created' })),
    remove: vi.fn(async () => undefined),
    getMigrationRequired: vi.fn(error =>
      error === 'migration' ? { pendingChanges: [migration] } : null
    ),
    validationRuleDefaults: () => ({
      id: 'rule-1',
      name: 'New rule',
      expression: 'true',
      message: 'Failed',
      severity: 'error' as const,
      active: true
    }),
    selectAfterDelete: (items, deletedId) => items.find(item => item.id !== deletedId)?.id ?? '',
    labels: {
      subject: 'schema',
      itemNoun: 'entity',
      deleteTitle: 'Delete schema?',
      deleteConfirmLabel: 'Delete',
      saveError: 'Save failed',
      createError: 'Create failed',
      deleteError: 'Delete failed'
    },
    ...overrides
  };
  return adapter;
};

describe('useSchemaEditorController', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: SchemaEditorController<
    TestSelected,
    TestField,
    TestGroup,
    TestExtra,
    'text' | 'number'
  >;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const Harness = ({
    selected,
    items,
    adapter,
    onSelect
  }: {
    selected: TestSelected | null;
    items: TestSelected[];
    adapter: SchemaEditorAdapter<TestSelected, TestField, TestGroup, TestExtra, 'text' | 'number'>;
    onSelect: (id: string) => void;
  }) => {
    latest = useSchemaEditorController({
      selected,
      items,
      fieldGroups: [
        {
          id: 'shared',
          workspace: 'workspace-1',
          name: 'Shared group',
          fields: [],
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        }
      ],
      adapter,
      onSelect
    });
    return null;
  };

  it('resets draft and transient lifecycle state when selection changes', () => {
    const adapter = makeAdapter();
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <Harness
          selected={selectedA}
          items={[selectedA, selectedB]}
          adapter={adapter}
          onSelect={onSelect}
        />
      );
    });
    act(() => {
      latest.addField();
      latest.setShowHistory(true);
      latest.setConfirmDelete(true);
      latest.setPendingFieldChanges([migration]);
      latest.setGroupDialogOpen(true);
      latest.setAccessDialogGroupId('group-1');
    });

    expect(latest.dirty).toBe(true);
    expect(latest.draft?.fields).toHaveLength(2);
    expect(latest.showHistory).toBe(true);
    expect(latest.confirmDelete).toBe(true);
    expect(latest.pendingFieldChanges).toEqual([migration]);

    act(() => {
      root.render(
        <Harness
          selected={selectedB}
          items={[selectedA, selectedB]}
          adapter={adapter}
          onSelect={onSelect}
        />
      );
    });

    expect(latest.selected).toBe(selectedB);
    expect(latest.draft?.name).toBe('Schema B');
    expect(latest.draft?.fields).toHaveLength(1);
    expect(latest.dirty).toBe(false);
    expect(latest.showHistory).toBe(false);
    expect(latest.confirmDelete).toBe(false);
    expect(latest.pendingFieldChanges).toBeNull();
    expect(latest.groupDialogOpen).toBe(false);
    expect(latest.accessDialogGroupId).toBeNull();
  });

  it('opens migration decisions and retries the save with serialized choices', async () => {
    const save = vi.fn().mockRejectedValueOnce('migration').mockResolvedValueOnce(undefined);
    const adapter = makeAdapter({ save });
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <Harness selected={selectedA} items={[selectedA]} adapter={adapter} onSelect={onSelect} />
      );
    });
    act(() => latest.updateDraft(current => ({ ...current, name: 'Changed' })));

    await act(async () => latest.save());
    expect(latest.pendingFieldChanges).toEqual([migration]);
    expect(latest.dirty).toBe(true);

    await act(async () => latest.confirmFieldMigrations({ old_field: 'archive' }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[2]).toEqual({ old_field: { action: 'archive' } });
    expect(latest.pendingFieldChanges).toBeNull();
    expect(latest.dirty).toBe(false);
  });

  it('shares field, group, access, validation, create, and delete actions', async () => {
    const create = vi.fn(async () => ({ id: 'created' }));
    const remove = vi.fn(async () => undefined);
    const adapter = makeAdapter({ create, remove });
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <Harness
          selected={selectedA}
          items={[selectedA, selectedB]}
          adapter={adapter}
          onSelect={onSelect}
        />
      );
    });
    act(() => {
      latest.addSharedFieldGroup('shared');
      latest.setGroupAccess('shared', ['team-1']);
      latest.addValidationRule();
    });

    expect(latest.draft?.sharedFieldGroupLinks).toEqual([
      { groupId: 'shared', teamIds: ['team-1'] }
    ]);
    expect(latest.draft?.groups).toEqual([{ id: 'shared', name: 'Shared group' }]);
    expect(latest.draft?.validationRules).toHaveLength(1);

    await act(async () => latest.create());
    expect(create).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('created');

    act(() => latest.setConfirmDelete(true));
    await act(async () => latest.deleteSelected());
    expect(remove).toHaveBeenCalledWith(selectedA);
    expect(onSelect).toHaveBeenLastCalledWith('schema-b');
  });
});
