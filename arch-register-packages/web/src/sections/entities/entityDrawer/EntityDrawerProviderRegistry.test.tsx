import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityDrawerProviderFrame } from './EntityDrawerProviderRegistry';

describe('EntityDrawerProviderFrame', () => {
  it('renders the slot label and content together', () => {
    const markup = renderToStaticMarkup(
      <EntityDrawerProviderFrame label="Coverage">
        <span>content</span>
      </EntityDrawerProviderFrame>
    );

    expect(markup).toContain('Coverage');
    expect(markup).toContain('content');
  });

  it('omits the label when showLabel is false', () => {
    const markup = renderToStaticMarkup(
      <EntityDrawerProviderFrame label="Coverage" showLabel={false}>
        <span>content</span>
      </EntityDrawerProviderFrame>
    );

    expect(markup).not.toContain('Coverage');
    expect(markup).toContain('content');
  });

  it('keeps mini-panel labels inside the shared panel chrome', () => {
    const markup = renderToStaticMarkup(
      <EntityDrawerProviderFrame label="vmRisk" presentation="mini-panel">
        <span>3.0</span>
      </EntityDrawerProviderFrame>
    );

    expect(markup.indexOf('vmRisk')).toBeLessThan(markup.indexOf('3.0'));
  });

  it('renders label adornments through the shared label element', () => {
    const markup = renderToStaticMarkup(
      <EntityDrawerProviderFrame label="Usage" labelAdornment={<span>5 visible references</span>}>
        <span>content</span>
      </EntityDrawerProviderFrame>
    );

    expect(markup).toContain('Usage');
    expect(markup).toContain('5 visible references');
  });
});
