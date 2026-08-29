import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';
import { WorkspaceContext, type WorkspaceContextType } from '../../layouts/WorkspaceContext';

vi.mock('@diagram-craft/app-components/TextArea', () => ({
  TextArea: ({
    value,
    disabled,
    placeholder
  }: {
    value: string;
    disabled?: boolean;
    placeholder?: string;
  }) => <textarea value={value} disabled={disabled} placeholder={placeholder} readOnly />
}));

const architectureCategoryId = 'category-architecture';

const workspaceContext = {
  categories: [
    {
      id: architectureCategoryId,
      workspaceId: 'ws-1',
      name: 'Architecture',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }
  ]
} as unknown as WorkspaceContextType;

const renderShell = (canEdit: boolean) =>
  renderToStaticMarkup(
    <WorkspaceContext.Provider value={workspaceContext}>
      <SchemaEditorFormShell
        name="Application"
        categoryId={architectureCategoryId}
        description="An application type"
        color={null}
        icon={null}
        dirty={false}
        canEdit={canEdit}
        updatePending={false}
        descriptionPlaceholder="Description"
        onNameChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onColorChange={vi.fn()}
        onIconChange={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      >
        <div>Editor body</div>
      </SchemaEditorFormShell>
    </WorkspaceContext.Provider>
  );

describe('SchemaEditorFormShell', () => {
  it('renders category metadata between the name area and description', () => {
    const markup = renderShell(true);
    expect(markup).toContain('Category');
    expect(markup).toContain('Architecture');
    expect(markup.indexOf('Category')).toBeLessThan(markup.indexOf('Description'));
  });

  it('disables category editing when schema editing is not allowed', () => {
    const markup = renderShell(false);
    const categoryIndex = markup.indexOf('Category');
    const disabledIndex = markup.indexOf('disabled=""', categoryIndex);
    expect(disabledIndex).toBeGreaterThan(-1);
    expect(disabledIndex).toBeLessThan(markup.indexOf('Description', categoryIndex));
  });
});
