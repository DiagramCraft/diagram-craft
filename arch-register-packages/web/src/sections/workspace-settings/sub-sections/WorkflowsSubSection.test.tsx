// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  GovernanceWorkflowCaseKind,
  GovernanceWorkflowConfigRow
} from '@arch-register/api-types/governanceWorkflowConfigContract';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn((_body: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.()),
  reset: vi.fn()
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
    buttons?: Array<{ label: string; disabled?: boolean; onClick?: () => void }>;
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
    children
  }: {
    value?: string;
    onChange: (value: string | undefined) => void;
    children: ReactNode;
  }) => (
    <select
      value={value ?? ''}
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

vi.mock('../../../components/Chip', () => ({
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));

vi.mock('../../../components/table/Table', () => {
  const Root = ({ children }: { children: ReactNode }) => <table>{children}</table>;
  const Head = ({ children }: { children: ReactNode }) => <thead>{children}</thead>;
  const Body = ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>;
  const Row = ({ children }: { children: ReactNode }) => <tr>{children}</tr>;
  const Cell = ({ children }: { children: ReactNode }) => <td>{children}</td>;
  const HeaderCell = ({ children }: { children: ReactNode }) => <th>{children}</th>;
  return { Table: { Root, Head, Body, Row, Cell, HeaderCell } };
});

vi.mock('./WorkflowConfigDialog', () => ({
  WorkflowConfigDialog: ({
    onClose,
    onSave
  }: {
    onClose: () => void;
    onSave: (body: unknown) => void;
  }) => (
    <div data-testid="workflow-config-dialog">
      <button
        type="button"
        onClick={() =>
          onSave({
            case_kind: 'document.status',
            case_subkind: null,
            name: 'Document status review',
            description: null,
            enabled: true,
            config: { extensions: {} }
          })
        }
      >
        Save workflow
      </button>
      <button type="button" onClick={onClose}>
        Close workflow
      </button>
    </div>
  )
}));

vi.mock('./WorkflowSubkindEditor', () => ({
  WorkflowSubkindEditor: () => <div data-testid="workflow-subkind-editor" />
}));

vi.mock('../../../hooks/useGovernanceWorkflowConfig', () => ({
  useGovernanceWorkflowConfig: () => ({ data: workflowData, isLoading: false, isError: false }),
  useUpsertGovernanceWorkflowConfig: () => ({ mutate: mocks.upsert }),
  useResetGovernanceWorkflowConfig: () => ({ mutate: mocks.reset })
}));

const simpleKind: GovernanceWorkflowCaseKind = {
  case_kind: 'entity.change-case',
  label: 'Entity change',
  description: 'Review entity changes.',
  supportsSubkind: false,
  supportsWorkspaceScope: true,
  supportsApprovals: true,
  supportsReminders: true,
  supportsEscalation: true,
  supportsInitiationFields: true,
  approvalStrategies: [],
  escalationStrategies: [],
  defaultConfig: { extensions: {} }
};

const existingRow: GovernanceWorkflowConfigRow = {
  id: 'workflow-1',
  case_kind: simpleKind.case_kind,
  case_kind_label: simpleKind.label,
  case_kind_description: simpleKind.description,
  case_subkind: null,
  case_subkind_label: null,
  name: 'Workspace entity review',
  description: 'Review changes to workspace entities.',
  enabled: true,
  config: { extensions: {} },
  updated_at: '2026-08-10T00:00:00.000Z',
  updated_by: null
};

let workflowData: {
  case_kinds: GovernanceWorkflowCaseKind[];
  configs: GovernanceWorkflowConfigRow[];
} = {
  case_kinds: [simpleKind],
  configs: [existingRow]
};

const { WorkflowsSubSection } = await import('./WorkflowsSubSection');

const renderCoordinator = (addDialogOpen = false) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const onCloseAddDialog = vi.fn();
  act(() => {
    root.render(
      <WorkflowsSubSection
        workspaceSlug="workspace-1"
        addDialogOpen={addDialogOpen}
        onCloseAddDialog={onCloseAddDialog}
      />
    );
  });
  return { container, root, onCloseAddDialog };
};

const buttonFor = (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
  return button;
};

afterEach(() => {
  document.body.replaceChildren();
  workflowData = { case_kinds: [simpleKind], configs: [existingRow] };
  mocks.upsert.mockClear();
  mocks.reset.mockClear();
});

describe('WorkflowsSubSection', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it('coordinates edit/save and remove mutations for an existing workflow', () => {
    const rendered = renderCoordinator();
    root = rendered.root;

    act(() => buttonFor(rendered.container, 'Remove').click());
    expect(mocks.reset).toHaveBeenCalledWith({
      case_kind: 'entity.change-case',
      case_subkind: null
    });

    act(() => buttonFor(rendered.container, 'Edit').click());
    expect(
      rendered.container.querySelector('[data-testid="workflow-config-dialog"]')
    ).not.toBeNull();

    act(() => buttonFor(rendered.container, 'Save workflow').click());
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        case_kind: 'document.status',
        case_subkind: null,
        name: 'Document status review',
        description: null,
        enabled: true,
        config: { extensions: {} }
      },
      expect.anything()
    );
    expect(rendered.container.querySelector('[data-testid="workflow-config-dialog"]')).toBeNull();
  });

  it('displays custom metadata and falls back to the derived description when absent', () => {
    const rendered = renderCoordinator();
    root = rendered.root;

    expect(rendered.container.textContent).toContain('Workspace entity review');
    expect(rendered.container.textContent).toContain('Review changes to workspace entities.');
    const customDescription = [...rendered.container.querySelectorAll('div')].find(
      item => item.textContent === 'Review changes to workspace entities.'
    );
    expect(customDescription?.getAttribute('title')).toBe(
      'Review changes to workspace entities.'
    );

    workflowData = { case_kinds: [simpleKind], configs: [{ ...existingRow, description: null }] };
    act(() => {
      root?.render(
        <WorkflowsSubSection
          workspaceSlug="workspace-1"
          addDialogOpen={false}
          onCloseAddDialog={vi.fn()}
        />
      );
    });

    expect(rendered.container.textContent).toContain('Review entity changes.');
    const fallbackDescription = [...rendered.container.querySelectorAll('div')].find(
      item => item.textContent === 'Review entity changes.'
    );
    expect(fallbackDescription?.getAttribute('title')).toBe(
      'Review entity changes.'
    );
  });

  it('creates a new workflow from the add dialog using the case-kind defaults', () => {
    workflowData = { case_kinds: [simpleKind], configs: [] };
    const rendered = renderCoordinator(true);
    root = rendered.root;

    act(() => buttonFor(rendered.container, 'Continue').click());
    expect(
      rendered.container.querySelector('[data-testid="workflow-config-dialog"]')
    ).not.toBeNull();
    expect(rendered.onCloseAddDialog).toHaveBeenCalled();

    act(() => buttonFor(rendered.container, 'Save workflow').click());
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
