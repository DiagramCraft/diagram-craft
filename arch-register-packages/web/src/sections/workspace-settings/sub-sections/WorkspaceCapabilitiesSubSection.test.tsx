// @vitest-environment jsdom
import { act, createContext, useContext } from 'react';
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

vi.mock('@diagram-craft/app-components/Tabs', () => {
  const TabsContext = createContext<(value: string) => void>(() => {});
  const Root = ({
    onValueChange,
    children
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => <TabsContext.Provider value={onValueChange}>{children}</TabsContext.Provider>;
  const List = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Trigger = ({ value, children }: { value: string; children: ReactNode }) => {
    const onValueChange = useContext(TabsContext);
    return (
      <button type="button" data-tab={value} onClick={() => onValueChange(value)}>
        {children}
      </button>
    );
  };
  const Content = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: { Root, List, Trigger, Content } };
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

const { WorkspaceCapabilitiesSubSection } = await import('./WorkspaceCapabilitiesSubSection');

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

describe('WorkspaceCapabilitiesSubSection', () => {
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

  it('renders a relation-schema picker (not a disclaimer) for a relation_schema-targeted role', () => {
    mocks.configurations = [];
    const el = render(
      <WorkspaceCapabilitiesSubSection
        workspaceSlug="workspace-1"
        schemas={entitySchemas}
        relationSchemas={relationSchemas}
        onActionsChange={() => {}}
      />
    );

    // Switch to the retention tab, which has a relation_schema-targeted 'assignment' role.
    const retentionTab = Array.from(el.querySelectorAll('button')).find(
      button => button.getAttribute('data-tab') === 'retention'
    );
    expect(retentionTab).toBeDefined();
    act(() => retentionTab!.click());

    const optionTexts = Array.from(el.querySelectorAll('option')).map(option => option.textContent);
    expect(optionTexts).toContain('Subject to Retention Policy');
    expect(el.textContent).not.toContain('Document and relation bindings are not used');
  });
});
