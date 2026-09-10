// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

const mocks = vi.hoisted(() => ({
  configurations: [] as unknown[],
  upsert: vi.fn()
}));

vi.mock('@diagram-craft/app-components/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}));

vi.mock('@diagram-craft/app-components/Checkbox', () => ({
  Checkbox: ({
    value,
    onChange,
    disabled
  }: {
    value?: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      checked={value ?? false}
      disabled={disabled}
      onChange={event => onChange(event.currentTarget.checked)}
    />
  )
}));

vi.mock('@diagram-craft/app-components/FormElement', () => ({
  FormElement: ({ label, children }: { label: string; children: ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  )
}));

vi.mock('@diagram-craft/app-components/Select', () => {
  const Root = ({
    value,
    onChange,
    disabled,
    children
  }: {
    value?: string;
    onChange: (value: string | undefined) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={event => onChange(event.currentTarget.value || undefined)}
    >
      {children}
    </select>
  );
  const Item = ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  );
  return { Select: { Root, Item } };
});

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useWorkspaceCapabilityConfigurations: () => ({
    data: mocks.configurations,
    isLoading: false
  }),
  useUpdateWorkspaceCapabilityConfiguration: () => ({
    mutateAsync: mocks.upsert,
    isPending: false
  }),
  useDeleteWorkspaceCapabilityConfiguration: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

const { CapabilityBindingEditor } = await import('./CapabilityBindingEditor');

const entitySchemas: EntitySchema[] = [
  {
    id: 'policy-schema',
    workspace: 'workspace-1',
    name: 'Retention Policy',
    description: '',
    fields: [
      { id: 'duration', name: 'Duration', type: 'number', requirementLevel: 'required' },
      { id: 'time_unit', name: 'Time unit', type: 'select', requirementLevel: 'required' }
    ],
    color: null,
    icon: null,
    default_owner: null
  } as unknown as EntitySchema
];

const relationSchemas: RelationSchema[] = [
  {
    id: 'assignment-schema',
    workspace: 'workspace-1',
    name: 'Subject to Retention Policy',
    description: '',
    in_schema_ids: 'any',
    out_schema_ids: ['policy-schema'],
    fields: [{ id: 'activated_from', name: 'Activated from', type: 'date' }],
    color: null,
    icon: null
  } as unknown as RelationSchema
];

describe('CapabilityBindingEditor', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    container = undefined;
    root = undefined;
    vi.clearAllMocks();
  });

  const render = (node: ReactNode) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(node));
    return container;
  };

  it('renders a relation-schema picker for a relation_schema-targeted role', () => {
    mocks.configurations = [];
    const el = render(
      <CapabilityBindingEditor
        workspaceSlug="workspace-1"
        capabilityType="retention"
        schemas={entitySchemas}
        relationSchemas={relationSchemas}
        subTab="bindings"
        onActionsChange={() => {}}
        onEnabledControlChange={() => {}}
      />
    );

    const optionTexts = Array.from(el.querySelectorAll('option')).map(option => option.textContent);
    expect(optionTexts).toContain('Subject to Retention Policy');
    expect(el.textContent).not.toContain('Document bindings are not used by this capability.');
  });
});
