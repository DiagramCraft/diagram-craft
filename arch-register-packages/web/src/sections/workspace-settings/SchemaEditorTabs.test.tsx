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
  onEditGroup: vi.fn(),
  onAccessGroup: vi.fn(),
  onRemoveGroup: vi.fn(),
  onRemoveSharedGroup: vi.fn(),
  templates: [],
  artifactCapabilities: [],
  onAddTemplate: vi.fn(),
  onEditTemplate: vi.fn(),
  onDeleteTemplate: vi.fn(),
  onAddArtifactCapability: vi.fn(),
  onUpdateArtifactCapability: vi.fn(),
  onDeleteArtifactCapability: vi.fn(),
  validationRules: [],
  validationPreviewPending: false,
  validationPreviewMessage: null,
  onPreviewValidation: vi.fn(),
  onAddValidationRule: vi.fn(),
  onUpdateValidationRule: vi.fn(),
  onToggleValidationRule: vi.fn(),
  onDeleteValidationRule: vi.fn()
};

describe('SchemaEditorTabs', () => {
  it('renders the stable fields, templates, and validation tabs', () => {
    const markup = renderToStaticMarkup(<SchemaEditorTabs {...props} />);
    expect(markup).toContain('Fields');
    expect(markup).toContain('Templates');
    expect(markup).toContain('Capabilities');
    expect(markup).toContain('Validation');
  });
});
