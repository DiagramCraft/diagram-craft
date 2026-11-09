import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ColorPicker } from './ColorPicker';

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('ColorPicker', () => {
  test('renders the default palette with one pressed swatch', () => {
    const html = renderToStaticMarkup(<ColorPicker value={SCHEMA_COLORS[0]} onChange={() => {}} />);
    expect(count(html, /<button/g)).toBe(SCHEMA_COLORS.length);
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
  });

  test('renders none option only with noneLabel, pressed when value is null', () => {
    const without = renderToStaticMarkup(<ColorPicker value={null} onChange={() => {}} />);
    expect(without).not.toContain('None');
    const html = renderToStaticMarkup(
      <ColorPicker value={null} noneLabel="None" onChange={() => {}} />
    );
    expect(count(html, /<button/g)).toBe(SCHEMA_COLORS.length + 1);
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
    expect(html).toContain('aria-label="None"');
  });

  test('renders labelled custom colors', () => {
    const html = renderToStaticMarkup(
      <ColorPicker
        value="b"
        colors={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta', swatch: 'red' }
        ]}
        onChange={() => {}}
      />
    );
    expect(html).toContain('Select color Alpha');
    expect(html).toContain('Select color Beta');
    expect(html).toContain('background-color:red');
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
  });

  test('disables all buttons', () => {
    const html = renderToStaticMarkup(
      <ColorPicker value={null} noneLabel="None" disabled onChange={() => {}} />
    );
    expect(html).not.toMatch(/<button(?![^>]*disabled)/);
  });
});
