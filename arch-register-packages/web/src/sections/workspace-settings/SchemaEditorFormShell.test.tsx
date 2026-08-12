import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';

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

const renderShell = (canEdit: boolean) =>
  renderToStaticMarkup(
    <SchemaEditorFormShell
      name="Application"
      category="Architecture"
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
  );

describe('SchemaEditorFormShell', () => {
  it('renders category metadata between the name area and description', () => {
    const markup = renderShell(true);
    expect(markup).toContain('Category');
    expect(markup).toContain('value="Architecture"');
    expect(markup.indexOf('Category')).toBeLessThan(markup.indexOf('Description'));
  });

  it('disables category editing when schema editing is not allowed', () => {
    const markup = renderShell(false);
    expect(markup).toMatch(/Category[\s\S]*?<input[^>]*disabled=""[^>]*value="Architecture"/);
  });
});
