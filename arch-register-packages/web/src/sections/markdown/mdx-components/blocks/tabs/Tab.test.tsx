import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tab } from './Tab';

describe('Tab', () => {
  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      <Tab label="Overview">
        <div data-testid="content">Hello</div>
      </Tab>
    );

    expect(markup).toContain('data-testid="content"');
    expect(markup).toContain('Hello');
  });

  it('marks itself as a tabpanel for accessibility', () => {
    const markup = renderToStaticMarkup(<Tab>text</Tab>);
    expect(markup).toContain('role="tabpanel"');
  });
});
