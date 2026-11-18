import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { registerCellEditor, resolveCellEditor, type CellEditor } from './cellEditors';

const props = { onCommit: () => {}, onCancel: () => {} };

describe('cell editor registry', () => {
  test('resolves built-in editors by key', () => {
    for (const key of ['text', 'number', 'date', 'select', 'boolean']) {
      expect(resolveCellEditor(key)).toBeDefined();
    }
    expect(resolveCellEditor('nope')).toBeUndefined();
  });

  test('passes editor objects through and supports registration', () => {
    const custom: CellEditor = { Editor: () => <b>custom</b> };
    expect(resolveCellEditor(custom)).toBe(custom);
    registerCellEditor('custom', custom);
    expect(resolveCellEditor('custom')).toBe(custom);
  });

  test('text editor starts from the value, or the seed when given', () => {
    const { Editor } = resolveCellEditor('text')!;
    expect(renderToStaticMarkup(<Editor value="Ada" {...props} />)).toContain('value="Ada"');
    expect(renderToStaticMarkup(<Editor value="Ada" seed="x" {...props} />)).toContain('value="x"');
  });

  test('number editor formats null as empty and flags errors', () => {
    const { Editor } = resolveCellEditor('number')!;
    expect(renderToStaticMarkup(<Editor value={null} {...props} />)).toContain('value=""');
    expect(renderToStaticMarkup(<Editor value={4} error="Bad" {...props} />)).toContain(
      'aria-invalid="true"'
    );
  });

  test('select editor renders options', () => {
    const { Editor } = resolveCellEditor('select')!;
    const html = renderToStaticMarkup(
      <Editor
        value="b"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' }
        ]}
        {...props}
      />
    );
    expect(html).toContain('>A</option>');
    expect(html).toContain('>B</option>');
  });
});
