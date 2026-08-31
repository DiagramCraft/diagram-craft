// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import { documentStatusExtension, parseDays } from './WorkflowConfigHelpers';

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

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({
    open,
    title,
    children,
    buttons = []
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
    buttons?: Array<{
      label: string;
      disabled?: boolean;
      onClick?: () => void;
    }>;
  }) =>
    open ? (
      <section>
        <h1>{title}</h1>
        {children}
        {buttons.map(button => (
          <button
            type="button"
            key={button.label}
            disabled={button.disabled}
            onClick={button.onClick}
          >
            {button.label}
          </button>
        ))}
      </section>
    ) : null
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
  const Root = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const List = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Trigger = ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  );
  const Content = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: { Root, List, Trigger, Content } };
});

vi.mock('@diagram-craft/app-components/TextInput', () => ({
  TextInput: ({
    value,
    type,
    onChange
  }: {
    value?: string;
    type?: string;
    onChange: (value: string) => void;
  }) => (
    <input
      type={type ?? 'text'}
      value={value ?? ''}
      onChange={event => onChange(event.currentTarget.value)}
    />
  )
}));

vi.mock('@diagram-craft/app-components/TextArea', () => ({
  TextArea: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
    <textarea
      data-testid="workflow-description"
      value={value ?? ''}
      onChange={event => onChange(event.currentTarget.value)}
    />
  )
}));

vi.mock('../../../components/Chip', () => ({
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));

vi.mock('../../../components/UserGroupPicker', () => ({
  UserGroupPicker: ({
    kind,
    onSelect
  }: {
    kind: 'user' | 'team';
    onSelect: (item: { id: string }) => void;
  }) => (
    <button type="button" onClick={() => onSelect({ id: kind === 'user' ? 'user-2' : 'team-2' })}>
      Add {kind}
    </button>
  )
}));

vi.mock('../../../hooks/useDocuments', () => ({
  useDocumentTypes: () => ({
    data: [
      {
        id: 'document-1',
        name: 'Change request',
        fields: [
          {
            id: 'status',
            name: 'Status',
            type: 'enum',
            retired: false,
            enumOptions: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' }
            ]
          },
          { id: 'owner', name: 'Owner', type: 'user_link', retired: false }
        ]
      }
    ]
  })
}));

vi.mock('../../../hooks/useEnums', () => ({
  useEnums: () => ({ data: [{ id: 'priority', name: 'Priority' }] })
}));

vi.mock('../../../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: [] })
}));

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useTeams: () => ({ data: [{ id: 'team-1', name: 'Reviewers' }] })
}));

vi.mock('../../../hooks/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => ({
    data: [{ user_id: 'user-1', display_name: 'Reviewer', is_active: true }]
  })
}));

const { WorkflowConfigDialog } = await import('./WorkflowConfigDialog');

const caseKind: GovernanceWorkflowCaseKind = {
  case_kind: 'document.status',
  label: 'Document status',
  description: 'Review document status transitions.',
  supportsSubkind: true,
  supportsWorkspaceScope: true,
  supportsApprovals: true,
  supportsReminders: true,
  supportsEscalation: true,
  supportsInitiationFields: true,
  approvalStrategies: [{ id: 'fallback', label: 'Fallback targets', configType: 'none' }],
  escalationStrategies: [{ id: 'fallback', label: 'Fallback targets', configType: 'none' }],
  defaultConfig: { extensions: {} }
};

const row: GovernanceWorkflowConfigRow = {
  id: 'workflow-1',
  case_kind: caseKind.case_kind,
  case_kind_label: caseKind.label,
  case_kind_description: caseKind.description,
  case_subkind: 'document-1:status',
  case_subkind_label: 'Change request · Status',
  name: 'Document approval',
  description: 'Review status transitions before publication.',
  enabled: true,
  config: { extensions: {} },
  updated_at: '2026-08-10T00:00:00.000Z',
  updated_by: null
};

const renderDialog = (onSave: (body: unknown) => void) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(
      <WorkflowConfigDialog
        row={row}
        caseKind={caseKind}
        workspaceSlug="workspace-1"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
  });
  return { container, root };
};

const checkboxFor = (container: HTMLElement, text: string) => {
  const label = [...container.querySelectorAll('label')].find(item =>
    item.textContent?.includes(text)
  );
  const checkbox = label?.querySelector('input[type="checkbox"]');
  if (!(checkbox instanceof HTMLInputElement)) throw new Error(`Missing checkbox: ${text}`);
  return checkbox;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('workflow configuration helpers', () => {
  it('parses only non-negative integer reminder days', () => {
    expect(parseDays('0, 2, nope, -1, 3.5, 7')).toEqual([0, 2, 7]);
  });

  it('reads document status values without disturbing unrelated extensions', () => {
    expect(
      documentStatusExtension({
        extensions: {
          unrelated: { enabled: true },
          'document.status': { statusesRequiringApprovals: ['published', 42, null] }
        }
      })
    ).toEqual({ statusesRequiringApprovals: ['published'] });
  });
});

describe('WorkflowConfigDialog', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it('saves approval, reminder, escalation, initiation-field, and status-value edits together', () => {
    let saved: unknown;
    const rendered = renderDialog(body => {
      saved = body;
    });
    root = rendered.root;

    act(() => checkboxFor(rendered.container, 'Enable approval policy').click());
    act(() => checkboxFor(rendered.container, 'Enable scheduled reminders').click());
    act(() => checkboxFor(rendered.container, 'Enable escalation').click());
    act(() => {
      [...rendered.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Add initiation field')
        ?.click();
    });
    act(() => checkboxFor(rendered.container, 'Published').click());
    act(() => {
      [...rendered.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Save workflow')
        ?.click();
    });

    expect(saved).toMatchObject({
      case_kind: 'document.status',
      case_subkind: 'document-1:status',
      name: 'Document approval',
      description: 'Review status transitions before publication.',
      enabled: true,
      config: {
        approvals: {
          requiredApprovals: 1,
          strategy: 'fallback',
          fallbackUserIds: [],
          fallbackTeamIds: []
        },
        reminders: { enabled: true, approachingDays: [], overdueDays: [] },
        escalation: {
          enabled: true,
          overdueDays: 5,
          strategy: 'fallback',
          fallbackUserIds: [],
          fallbackTeamIds: []
        },
        initiationFields: [
          { id: 'field-1', label: 'New field', type: 'text', requirementLevel: 'optional' }
        ],
        extensions: { 'document.status': { statusesRequiringApprovals: ['published'] } }
      }
    });
  });

  it('clears the optional description when it is emptied', () => {
    let saved: unknown;
    const rendered = renderDialog(body => {
      saved = body;
    });
    root = rendered.root;

    const descriptionInput = rendered.container.querySelector(
      '[data-testid="workflow-description"]'
    );
    if (!(descriptionInput instanceof HTMLTextAreaElement))
      throw new Error('Missing description input');

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(descriptionInput, '');
      descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      [...rendered.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Save workflow')
        ?.click();
    });

    expect(saved).toMatchObject({ name: 'Document approval', description: null });
  });

  it('reinitializes draft state when editing a different workflow row', () => {
    const onSave = vi.fn();
    const rendered = renderDialog(onSave);
    root = rendered.root;
    const changedRow = {
      ...row,
      id: 'workflow-2',
      enabled: false,
      name: 'Changed approval',
      description: 'Changed description.'
    };

    act(() => {
      root?.render(
        <WorkflowConfigDialog
          row={changedRow}
          caseKind={caseKind}
          workspaceSlug="workspace-1"
          onClose={vi.fn()}
          onSave={onSave}
        />
      );
    });
    act(() => {
      [...rendered.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Save workflow')
        ?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        case_subkind: 'document-1:status',
        name: 'Changed approval',
        description: 'Changed description.'
      })
    );
  });
});
