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
    const html = renderToStaticMarkup(<ViewControls>content</ViewControls>);
    expect(html).toContain('data-variant="inline"');
    expect(html).toContain('data-padding="default"');
    expect(html).toContain('content');
  });

  test('reflects variant and option props as data attributes', () => {
    const html = renderToStaticMarkup(
      <ViewControls variant="bar" padding="none" nowrap spaced compactButtons className="extra">
        x
      </ViewControls>
    );
    expect(html).toContain('data-variant="bar"');
    expect(html).toContain('data-padding="none"');
    expect(html).toContain('data-nowrap');
    expect(html).toContain('data-spaced');
    expect(html).toContain('data-compact-buttons');
    expect(html).toContain('extra');
  });

  test('omits optional data attributes by default', () => {
    const html = renderToStaticMarkup(<ViewControls>x</ViewControls>);
    expect(html).not.toContain('data-nowrap');
    expect(html).not.toContain('data-spaced');
    expect(html).not.toContain('data-compact-buttons');
  });

  test('renders spacer and separator', () => {
    const html = renderToStaticMarkup(
      <ViewControls>
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
