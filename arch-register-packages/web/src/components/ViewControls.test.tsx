import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import {
  ViewControls,
  ViewControlsFrame,
  ViewControlsSeparator,
  ViewControlsSpacer
} from './ViewControls';

describe('ViewControls', () => {
  test('defaults to the inline variant with default padding', () => {
    const html = renderToStaticMarkup(<ViewControls variant="page">content</ViewControls>);
    expect(html).toContain('data-variant="page"');
    expect(html).toContain('content');
  });

  test('reflects variant and option props as data attributes', () => {
    const html = renderToStaticMarkup(
      <ViewControls variant="view" nowrap className="extra">
        x
      </ViewControls>
    );
    expect(html).toContain('data-variant="view"');
    expect(html).toContain('data-nowrap');
    expect(html).toContain('extra');
  });

  test('omits optional data attributes by default', () => {
    const html = renderToStaticMarkup(<ViewControls variant="page">x</ViewControls>);
    expect(html).not.toContain('data-nowrap');
  });

  test('renders spacer and separator', () => {
    const html = renderToStaticMarkup(
      <ViewControls variant="page">
        <ViewControlsSpacer />
        <ViewControlsSeparator />
      </ViewControls>
    );
    expect(html).toContain('<hr');
  });

  test('frame supports fill', () => {
    expect(renderToStaticMarkup(<ViewControlsFrame fill>x</ViewControlsFrame>)).toContain(
      'data-fill'
    );
    expect(renderToStaticMarkup(<ViewControlsFrame>x</ViewControlsFrame>)).not.toContain(
      'data-fill'
    );
  });
});
