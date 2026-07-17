import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Callout } from './Callout';

describe('Callout', () => {
  it('renders children wrapped in the callout container', () => {
    const markup = renderToStaticMarkup(
      <Callout variant="info">
        <p data-testid="child">Some prose</p>
      </Callout>
    );

    expect(markup).toContain('data-testid="child"');
    expect(markup).toContain('Some prose');
  });

  it('defaults to the info variant when none is given', () => {
    const markup = renderToStaticMarkup(<Callout>text</Callout>);
    expect(markup).toContain('info');
  });

  it('defaults to the info variant when given an unknown variant', () => {
    const markup = renderToStaticMarkup(<Callout variant="bogus">text</Callout>);
    expect(markup).toContain('info');
  });

  it.each([
    'info',
    'warning',
    'danger',
    'success',
    'note'
  ] as const)('renders the %s variant class', variant => {
    const markup = renderToStaticMarkup(<Callout variant={variant}>text</Callout>);
    expect(markup).toContain(variant);
  });

  it('wraps multiple block-level children (paragraphs, lists)', () => {
    const markup = renderToStaticMarkup(
      <Callout variant="warning">
        <p>First paragraph</p>
        <ul>
          <li>Item one</li>
        </ul>
      </Callout>
    );

    expect(markup).toContain('First paragraph');
    expect(markup).toContain('Item one');
  });
});
