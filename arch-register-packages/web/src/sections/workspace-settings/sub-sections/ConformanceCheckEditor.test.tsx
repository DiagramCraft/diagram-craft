// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConformanceCheck } from '@arch-register/api-types/conformanceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

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

vi.mock('@diagram-craft/app-components/TextInput', () => ({
  TextInput: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
    <input
      type="text"
      value={value ?? ''}
      onChange={event => onChange(event.currentTarget.value)}
    />
  )
}));

vi.mock('../../../components/ConformanceBadges', () => ({
  CHECK_TYPE_META: {
    scheduled_validation: { label: 'Scheduled validation', description: 'Scheduled validation' },
    query_policy: { label: 'Query policy', description: 'Query policy' },
    ai_prompt: { label: 'AI prompt', description: 'AI prompt' }
  }
}));

vi.mock('../../../components/FilterBuilder', () => ({
  FilterBuilder: ({ headerActions }: { headerActions?: ReactNode }) => (
    <div data-testid="filter-builder">{headerActions}</div>
  )
}));

vi.mock('../../entities/components/entityBrowserState', () => ({
  buildEntityQueryFromBrowserFilters: ({ conditions }: { conditions: unknown[] }) => ({
    root: { kind: 'and', children: conditions }
  }),
  entityQueryToBrowserFilters: () => ({ conditions: [], q: '' }),
  getFilterValue: () => null,
  isBasicRepresentable: () => true
}));

const { ConformanceCheckEditor } = await import('./ConformanceCheckEditor');

const schemas = [
  {
    id: 'schema-1',
    name: 'Application',
    fields: [{ id: 'lifecycle', name: 'Lifecycle' }]
  }
] as unknown as EntitySchema[];

const makeScheduledCheck = (overrides: Partial<ConformanceCheck> = {}): ConformanceCheck => ({
  id: 'check-1',
  workspace: 'workspace-1',
  name: 'Original name',
  description: 'Original description',
  severity: 'error',
  enabled: true,
  definition: {
    type: 'scheduled_validation',
    schemaId: 'schema-1',
    expression: 'entity.lifecycle != null',
    message: 'Original message'
  },
  revision: 1,
  created_by: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...overrides
});

const renderEditor = (
  root: Root,
  onSubmit: (body: unknown) => void,
  props: Partial<React.ComponentProps<typeof ConformanceCheckEditor>> = {}
) => {
  root.render(
    <ConformanceCheckEditor
      open
      onClose={vi.fn()}
      schemas={schemas}
      lifecycleStates={[]}
      owners={[]}
      enums={[]}
      getFieldGroupAccess={() => ({}) as never}
      aiConfigured
      check={makeScheduledCheck()}
      initialType="scheduled_validation"
      onSubmit={onSubmit}
      pending={false}
      error={null}
      {...props}
    />
  );
};

const setTextValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('ConformanceCheckEditor', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  const setup = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    return { container, root };
  };

  it('keeps unsaved draft values when the fetched check object is refreshed', () => {
    const rendered = setup();
    const submitted: unknown[] = [];
    act(() => renderEditor(rendered.root, body => submitted.push(body)));

    const inputs = rendered.container.querySelectorAll('input[type="text"]');
    const nameInput = inputs[0];
    const expression = rendered.container.querySelector('textarea');
    if (!(nameInput instanceof HTMLInputElement) || !(expression instanceof HTMLTextAreaElement)) {
      throw new Error('Missing editor controls');
    }
    act(() => {
      setTextValue(nameInput, 'Draft name');
      setTextValue(expression, 'entity.lifecycle == "active"');
    });

    act(() =>
      renderEditor(rendered.root, body => submitted.push(body), {
        check: makeScheduledCheck({
          name: 'Refetched name',
          definition: {
            type: 'scheduled_validation',
            schemaId: 'schema-1',
            expression: 'refetched expression',
            message: 'Refetched message'
          },
          revision: 2
        })
      })
    );

    expect(nameInput.value).toBe('Draft name');
    expect(expression.value).toBe('entity.lifecycle == "active"');

    act(() => {
      [...rendered.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Save changes')
        ?.click();
    });
    expect(submitted[0]).toMatchObject({
      name: 'Draft name',
      definition: {
        type: 'scheduled_validation',
        expression: 'entity.lifecycle == "active"'
      }
    });
  });

  it('reinitializes when the edited check changes and when the dialog reopens', () => {
    const rendered = setup();
    const onSubmit = vi.fn();
    act(() => renderEditor(rendered.root, onSubmit));

    const changedCheck = makeScheduledCheck({
      id: 'check-2',
      name: 'Second check',
      definition: {
        type: 'scheduled_validation',
        schemaId: 'schema-1',
        expression: 'second expression',
        message: 'Second message'
      }
    });
    act(() => renderEditor(rendered.root, onSubmit, { check: changedCheck }));
    const nameInput = rendered.container.querySelector('input[type="text"]');
    const expression = rendered.container.querySelector('textarea');
    if (!(nameInput instanceof HTMLInputElement) || !(expression instanceof HTMLTextAreaElement)) {
      throw new Error('Missing editor controls');
    }
    expect(nameInput.value).toBe('Second check');
    expect(expression.value).toBe('second expression');

    act(() => renderEditor(rendered.root, onSubmit, { open: false, check: changedCheck }));
    act(() => renderEditor(rendered.root, onSubmit, { open: true, check: changedCheck }));
    expect((rendered.container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe(
      'Second check'
    );
  });
});
