// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useNavigate: () => vi.fn(),
    useSearch: () => ({ schema: 'schema-1' })
  })
}));

vi.mock('../../dialogs/EntityTemplateDialog', () => ({
  EntityTemplateDialog: () => null
}));

vi.mock('../../hooks/useSchemas', () => ({
  useCreateSchema: () => ({ mutateAsync: vi.fn() }),
  useUpdateSchema: () => ({ mutateAsync: vi.fn() }),
  useDeleteSchema: () => ({ mutateAsync: vi.fn() }),
  getSchemaMigrationRequired: () => null
}));

const makeSchema = (): EntitySchema =>
  ({
    id: 'schema-1',
    name: 'Service',
    key_prefix: 'SRV',
    description: '',
    version: 1,
    entity_count: 0,
    color: null,
    icon: null,
    entity_approval_policy: 'disabled',
    deprecation_policy: 'disabled',
    templates: [],
    shared_field_group_links: [],
    groups: [
      {
        id: 'group-1',
        name: 'Restricted group',
        accessControl: { teamIds: ['team-1'] }
      }
    ],
    fields: [
      {
        id: 'restricted_field',
        name: 'Restricted field',
        type: 'text',
        groupId: 'group-1'
      }
    ]
  }) as unknown as EntitySchema;

let canEditSchemas = true;

vi.mock('../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaceSlug: 'workspace-1',
    schemas: [makeSchema()],
    enums: [],
    fieldGroups: [],
    teams: [{ id: 'team-1', name: 'Restricted team' }],
    lifecycleStates: [],
    permissions: { canEditSchemas },
    openAddProjectDialog: vi.fn(),
    openAddEntityDialog: vi.fn()
  })
}));

const { SchemaSettingsScreen } = await import('./SchemaSettingsScreen');

let container: HTMLDivElement | null = null;

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

const renderScreen = (nextCanEditSchemas: boolean) => {
  canEditSchemas = nextCanEditSchemas;
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
        <SchemaSettingsScreen />
      </DialogContextProvider>
    );
  });
  return container;
};

const findIdInput = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('input')).find(input => input.value === 'restricted_field');

describe('SchemaSettingsScreen field-group gating', () => {
  it('keeps field editing enabled for a schema.edit holder even when the field belongs to a group restricted to another team', () => {
    const root = renderScreen(true);
    // The "Restricted field" Id input must not be disabled: schema.edit is the sole authority
    // boundary for schema structure, independent of the field's group access control.
    const idInput = findIdInput(root);
    expect(idInput).toBeDefined();
    expect(idInput?.disabled).toBe(false);
    // The restricted group's "Add field" action must still be offered.
    expect(root.textContent).toContain('Add field');
  });

  it('still disables field editing when the caller lacks schema.edit', () => {
    const root = renderScreen(false);
    const idInput = findIdInput(root);
    expect(idInput).toBeDefined();
    expect(idInput?.disabled).toBe(true);
  });
});
