import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { IconPicker } from './IconPicker';

describe('IconPicker', () => {
  test('marks the selected icon as pressed', () => {
    const html = renderToStaticMarkup(<IconPicker value="server" onChange={() => {}} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="server"/);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  test('renders a none option that is pressed when nothing is selected', () => {
    const html = renderToStaticMarkup(
      <IconPicker value={undefined} onChange={() => {}} noneLabel="Default" />
    );
    expect(html).toContain('Default');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  test('disables all buttons', () => {
    const html = renderToStaticMarkup(<IconPicker value="server" onChange={() => {}} disabled />);
    expect(html).not.toMatch(/<button(?![^>]*disabled)/);
  });
});
