import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { SchemaEditorTabs } from './SchemaEditorTabs';

const props: ComponentProps<typeof SchemaEditorTabs> = {
  activeTab: 'templates',
  onTabChange: vi.fn(),
  fields: [],
  groups: [],
  sharedFieldGroupLinks: [],
  fieldKeys: new Map(),
  schemas: [],
  relationSchemas: [],
  enums: [],
  teams: [],
  canEdit: true,
  onAddField: vi.fn(),
  onAddGroup: vi.fn(),
  onUpdateField: vi.fn(),
  onChangeFieldType: vi.fn(),
  onRemoveField: vi.fn(),
  onReorderField: vi.fn(),
  onEditGroup: vi.fn(),
  onAccessGroup: vi.fn(),
  onRemoveGroup: vi.fn(),
  onRemoveSharedGroup: vi.fn(),
  templates: [],
  onAddTemplate: vi.fn(),
  onEditTemplate: vi.fn(),
  onDeleteTemplate: vi.fn(),
  validationRules: [],
  validationPreviewPending: false,
  validationPreviewMessage: null,
  onPreviewValidation: vi.fn(),
  onAddValidationRule: vi.fn(),
  onUpdateValidationRule: vi.fn(),
  onToggleValidationRule: vi.fn(),
  onDeleteValidationRule: vi.fn(),
  detailLayoutEnabled: false,
  onToggleDetailLayoutEnabled: vi.fn(),
  detailLayout: { version: 1, tabs: [] },
  onDetailLayoutChange: vi.fn()
};

describe('SchemaEditorTabs', () => {
  it('renders the stable fields, templates, validation, and layout tabs', () => {
    const markup = renderToStaticMarkup(<SchemaEditorTabs {...props} />);
    expect(markup).toContain('Fields');
    expect(markup).toContain('Templates');
    expect(markup).toContain('Validation');
    expect(markup).toContain('Layout');
  });

  it('shows the custom layout editor only when the toggle is enabled', () => {
    const disabledMarkup = renderToStaticMarkup(<SchemaEditorTabs {...props} activeTab="layout" />);
    expect(disabledMarkup).toContain('Using the default layout');

    const enabledMarkup = renderToStaticMarkup(
      <SchemaEditorTabs {...props} activeTab="layout" detailLayoutEnabled={true} />
    );
    expect(enabledMarkup).toContain('Detail/Edit layout');
    expect(enabledMarkup).not.toContain('Using the default layout');
  });
});
