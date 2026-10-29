import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { LabeledValue } from './LabeledValue';

describe('LabeledValue', () => {
  test('renders the label and the value', () => {
    const html = renderToStaticMarkup(<LabeledValue label="Type" value="System" />);
    expect(html).toContain('Type');
    expect(html).toContain('System');
  });
});
