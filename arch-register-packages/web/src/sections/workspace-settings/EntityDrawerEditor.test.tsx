// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type {
  EntityDrawerCatalog,
  EntityDrawerConfiguration,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { WorkspaceContext, type WorkspaceContextType } from '../../layouts/WorkspaceContext';

vi.mock('@diagram-craft/app-components/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
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

vi.mock('@diagram-craft/app-components/Menu', () => ({
  Menu: {
    Item: ({
      children,
      onClick,
      type
    }: {
      children: ReactNode;
      onClick?: () => void;
      type?: string;
    }) => (
      <button type="button" data-menu-item-type={type} onClick={onClick}>
        {children}
      </button>
    ),
    CheckboxItem: ({
      children,
      checked,
      disabled,
      onCheckedChange
    }: {
      children: ReactNode;
      checked: boolean;
      disabled?: boolean;
      onCheckedChange: (value: boolean) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={event => onCheckedChange(event.currentTarget.checked)}
        />
        {children}
      </label>
    ),
    RadioGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    RadioItem: ({
      value,
      children,
      onClick
    }: {
      value: string;
      children: ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" data-radio-value={value} onClick={onClick}>
        {children}
      </button>
    ),
    SubMenu: ({ label, children }: { label: string; children: ReactNode }) => (
      <div>
        <span>{label}</span>
        {children}
      </div>
    ),
    Separator: () => <hr />
  }
}));

vi.mock('@diagram-craft/app-components/MenuButton', () => ({
  MenuButton: {
    Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Trigger: ({
      children,
      'aria-label': ariaLabel
    }: {
      children: ReactNode;
      'aria-label'?: string;
    }) => (
      <button type="button" aria-label={ariaLabel}>
        {children}
      </button>
    ),
    Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }
}));

const mutate = vi.fn();
let configurationQueryData: {
  effective_configuration: EntityDrawerConfiguration;
  stored_configuration: EntityDrawerConfiguration;
  diagnostics: Array<{ code: string; message: string }>;
};
let catalogQueryData: EntityDrawerCatalog;

vi.mock('../../hooks/useWorkspaceConfig', () => ({
  useEntityDrawerConfiguration: () => ({ data: configurationQueryData }),
  useEntityDrawerCatalog: () => ({ data: catalogQueryData }),
  useUpdateEntityDrawerConfiguration: () => ({ mutate, isPending: false })
}));

const { EntityDrawerEditor } = await import('./EntityDrawerSettingsScreen');

const schema = {
  id: 'schema-app',
  name: 'Application',
  fields: [
    { id: 'field-name', name: 'Name', type: 'text', archived: false },
    {
      id: 'field-owner',
      name: 'Owner',
      type: 'typedRelation',
      relationSchemaId: 'rel-owns',
      direction: 'out',
      archived: false
    }
  ]
} as unknown as EntitySchema;

const otherSchema = {
  id: 'schema-team',
  name: 'Team',
  fields: [{ id: 'field-title', name: 'Title', type: 'text', archived: false }]
} as unknown as EntitySchema;

const relationSchema = {
  id: 'rel-owns',
  in: { schemaIds: [otherSchema.id] },
  out: { schemaIds: [schema.id] }
} as unknown as RelationSchema;

const catalogFixture: EntityDrawerCatalog = {
  schemas: [
    {
      id: schema.id,
      name: schema.name,
      fields: [
        { id: 'field-name', name: 'Name', type: 'text', archived: false, groupId: null },
        {
          id: 'field-owner',
          name: 'Owner',
          type: 'typedRelation',
          archived: false,
          groupId: null
        }
      ]
    },
    {
      id: otherSchema.id,
      name: otherSchema.name,
      fields: [{ id: 'field-title', name: 'Title', type: 'text', archived: false, groupId: null }]
    }
  ],
  metadataSlots: [
    { id: 'owner', label: 'Owner', description: '' },
    { id: 'tags', label: 'Tags', description: '' }
  ],
  slots: []
};

const emptyConfiguration = (): EntityDrawerConfiguration => ({ version: 1, profiles: {} });

const buildConfigurationQueryData = (storedProfile?: EntityDrawerProfile) => ({
  effective_configuration: emptyConfiguration(),
  stored_configuration: storedProfile
    ? { version: 1 as const, profiles: { [schema.id]: storedProfile } }
    : emptyConfiguration(),
  diagnostics: [] as Array<{ code: string; message: string }>
});

const customProfileFixture = (): EntityDrawerProfile => ({
  header: { badges: [] },
  sections: [
    {
      id: 'section-1',
      title: 'Details',
      showTitle: true,
      collapsible: true,
      items: [{ kind: 'field', fieldId: 'field-name' }]
    }
  ]
});

const workspaceContext = {
  workspaceSlug: 'workspace-1',
  schemas: [schema, otherSchema],
  relationSchemas: [relationSchema]
} as unknown as WorkspaceContextType;

const renderEditor = (canEdit = true) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(
      <WorkspaceContext.Provider value={workspaceContext}>
        <EntityDrawerEditor schemaId={schema.id} canEdit={canEdit} />
      </WorkspaceContext.Provider>
    );
  });
  return { container, root };
};

const clickButton = (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => button.click());
};

const findButton = (container: HTMLElement, ariaLabel: string) => {
  const button = container.querySelector(`button[aria-label="${ariaLabel}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${ariaLabel}`);
  return button;
};

const findTextInput = (container: HTMLElement, index = 0) => {
  const input = [...container.querySelectorAll('input')].filter(
    candidate => candidate.type !== 'checkbox'
  )[index];
  if (!input) throw new Error(`Missing text input at index ${index}`);
  return input;
};

const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  mutate.mockClear();
  document.body.replaceChildren();
});

describe('EntityDrawerEditor', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  describe('default vs custom layout switching', () => {
    it('shows the default-layout message and a customize action when no profile is configured', () => {
      configurationQueryData = buildConfigurationQueryData();
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      expect(rendered.container.textContent).toContain('Using the default drawer layout');
      expect(
        [...rendered.container.querySelectorAll('button')].some(
          button => button.textContent === 'Use a custom layout'
        )
      ).toBe(true);
    });

    it('clones the fallback profile into a custom layout when starting to customize', () => {
      configurationQueryData = buildConfigurationQueryData();
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Use a custom layout');

      expect(
        rendered.container.querySelector('input[type="checkbox"]')
      ).not.toBeNull();
      expect(rendered.container.textContent).toContain('Entity drawer layout');
    });

    it('mounts directly into the custom layout when a stored profile already exists', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      expect(rendered.container.textContent).toContain('Entity drawer layout');
      expect(rendered.container.textContent).not.toContain('Using the default drawer layout');
    });
  });

  describe('editing sections and items', () => {
    it('saves an edited section title', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const titleInput = findTextInput(rendered.container, 0);
      act(() => setInputValue(titleInput, 'Overview'));
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [expect.objectContaining({ title: 'Overview' })]
            })
          }
        })
      );
    });

    it('adds a placeholder item via the add-content menu', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Add content');
      clickButton(rendered.container, 'Placeholder text');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [
                    { kind: 'field', fieldId: 'field-name' },
                    { kind: 'placeholder', message: 'Not yet available.' }
                  ]
                })
              ]
            })
          }
        })
      );
    });
  });

  describe('ordering and removal', () => {
    it('reorders items within a section', () => {
      const profile = customProfileFixture();
      profile.sections[0]!.items.push({ kind: 'placeholder', message: 'Second item' });
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      act(() => findButton(rendered.container, 'Move content down').click());
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [
                    { kind: 'placeholder', message: 'Second item' },
                    { kind: 'field', fieldId: 'field-name' }
                  ]
                })
              ]
            })
          }
        })
      );
    });

    it('disables the move-up button for the first item and move-down for the last', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      expect(findButton(rendered.container, 'Move content up').disabled).toBe(true);
      expect(findButton(rendered.container, 'Move content down').disabled).toBe(true);
    });

    it('removes an item from a section', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Remove content');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [expect.objectContaining({ items: [] })]
            })
          }
        })
      );
    });

    it('removes a section', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Remove section');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: { [schema.id]: expect.objectContaining({ sections: [] }) }
        })
      );
    });
  });

  describe('reset to default', () => {
    it('deletes the schema profile and offers a save once the custom layout is disabled', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const toggle = rendered.container.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      act(() => toggle.click());

      expect(rendered.container.textContent).toContain('Using the default drawer layout');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ profiles: {} })
      );
    });
  });

  describe('read-only mode', () => {
    it('disables the editing fieldset and hides the customize action when canEdit is false', () => {
      configurationQueryData = buildConfigurationQueryData();
      catalogQueryData = catalogFixture;
      const rendered = renderEditor(false);
      root = rendered.root;

      expect(
        [...rendered.container.querySelectorAll('button')].some(
          button => button.textContent === 'Use a custom layout'
        )
      ).toBe(false);
    });

    it('disables the fieldset and the layout toggle when a custom profile is read-only', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor(false);
      root = rendered.root;

      const fieldset = rendered.container.querySelector('fieldset');
      expect(fieldset?.disabled).toBe(true);
      const toggle = rendered.container.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      expect(toggle.disabled).toBe(true);
      expect(
        [...rendered.container.querySelectorAll('button')].some(
          button => button.textContent === 'Save changes'
        )
      ).toBe(false);
    });
  });

  describe('successful configuration update', () => {
    it('calls the update mutation once with the full configuration on save', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate).toHaveBeenCalledWith({
        version: 1,
        profiles: { [schema.id]: customProfileFixture() }
      });
    });

    it('renders a diagnostics warning when stale configuration entries are present', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      configurationQueryData.diagnostics = [
        { code: 'missing_or_archived_field', message: 'Field is archived.' }
      ];
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const alert = rendered.container.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('1 stale or invalid configuration entries');
    });
  });

  describe('query validation', () => {
    it('seeds a non-empty default query text when a query item is added', () => {
      configurationQueryData = buildConfigurationQueryData(customProfileFixture());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Add content');
      clickButton(rendered.container, 'Query');

      const queryTextArea = [...rendered.container.querySelectorAll('textarea')].find(textarea =>
        textarea.getAttribute('aria-label')?.endsWith('query text')
      );
      expect(queryTextArea?.value).toBe('<-"Relation name"');
    });

    it('saves an edited, valid path-expression query', () => {
      const profile = customProfileFixture();
      profile.sections[0]!.items = [
        { kind: 'query', queryText: '<-"Relation name"', presentation: 'list' }
      ];
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const queryTextArea = [...rendered.container.querySelectorAll('textarea')].find(textarea =>
        textarea.getAttribute('aria-label')?.endsWith('query text')
      ) as HTMLTextAreaElement;
      act(() => setInputValue(queryTextArea, '<-"Relation name".field-name'));
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [
                    expect.objectContaining({ queryText: '<-"Relation name".field-name' })
                  ]
                })
              ]
            })
          }
        })
      );
    });

    it('does not block saving an emptied query text (validation is enforced by the model layer)', () => {
      const profile = customProfileFixture();
      profile.sections[0]!.items = [
        { kind: 'query', queryText: '<-"Relation name"', presentation: 'list' }
      ];
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const queryTextArea = [...rendered.container.querySelectorAll('textarea')].find(textarea =>
        textarea.getAttribute('aria-label')?.endsWith('query text')
      ) as HTMLTextAreaElement;
      act(() => setInputValue(queryTextArea, ''));
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [expect.objectContaining({ queryText: '' })]
                })
              ]
            })
          }
        })
      );
    });
  });

  describe('typed-relation attribute selection', () => {
    const withTypedRelationItem = (): EntityDrawerProfile => ({
      header: { badges: [] },
      sections: [
        {
          id: 'section-1',
          title: 'Relations',
          showTitle: true,
          collapsible: true,
          items: [{ kind: 'typed-relation-list', fieldId: 'field-owner', attributes: [] }]
        }
      ]
    });

    it('adds an attribute row scoped to the typed relation target schema fields', () => {
      configurationQueryData = buildConfigurationQueryData(withTypedRelationItem());
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Add attribute');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [
                    expect.objectContaining({
                      attributes: [{ fieldId: 'field-title' }]
                    })
                  ]
                })
              ]
            })
          }
        })
      );
    });

    it('sets a label override on an attribute', () => {
      const profile = withTypedRelationItem();
      (profile.sections[0]!.items[0] as { attributes: Array<{ fieldId: string }> }).attributes = [
        { fieldId: 'field-title' }
      ];
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const attributeLabelInput = [
        ...rendered.container.querySelectorAll('input')
      ].filter(candidate => candidate.type !== 'checkbox').at(-1)!;
      act(() => setInputValue(attributeLabelInput, 'Team name'));
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [
                    expect.objectContaining({
                      attributes: [{ fieldId: 'field-title', label: 'Team name' }]
                    })
                  ]
                })
              ]
            })
          }
        })
      );
    });

    it('removes an attribute', () => {
      const profile = withTypedRelationItem();
      (profile.sections[0]!.items[0] as { attributes: Array<{ fieldId: string }> }).attributes = [
        { fieldId: 'field-title' }
      ];
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      clickButton(rendered.container, 'Remove attribute');
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [expect.objectContaining({ attributes: [] })]
                })
              ]
            })
          }
        })
      );
    });

    it('resets attributes when switching the typed-relation field', () => {
      const profile = withTypedRelationItem();
      (profile.sections[0]!.items[0] as { attributes: Array<{ fieldId: string }> }).attributes = [
        { fieldId: 'field-title' }
      ];
      configurationQueryData = buildConfigurationQueryData(profile);
      catalogQueryData = catalogFixture;
      const rendered = renderEditor();
      root = rendered.root;

      const fieldSelect = [...rendered.container.querySelectorAll('select')][0] as HTMLSelectElement;
      act(() => {
        fieldSelect.value = 'field-owner';
        fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      clickButton(rendered.container, 'Save changes');

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          profiles: {
            [schema.id]: expect.objectContaining({
              sections: [
                expect.objectContaining({
                  items: [expect.objectContaining({ fieldId: 'field-owner', attributes: [] })]
                })
              ]
            })
          }
        })
      );
    });
  });
});
