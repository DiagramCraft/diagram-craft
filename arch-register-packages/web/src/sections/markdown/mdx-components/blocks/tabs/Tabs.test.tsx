import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';
import { Tab } from './Tab';

describe('Tabs', () => {
  it('renders a tab button per child using its label', () => {
    const markup = renderToStaticMarkup(
      <Tabs>
        <Tab label="Linux">Linux steps</Tab>
        <Tab label="macOS">macOS steps</Tab>
      </Tabs>
    );

    expect(markup).toContain('Linux');
    expect(markup).toContain('macOS');
    expect(markup).toContain('role="tablist"');
  });

  it('falls back to a positional label when a tab has no label', () => {
    const markup = renderToStaticMarkup(
      <Tabs>
        <Tab>First</Tab>
        <Tab>Second</Tab>
      </Tabs>
    );

    expect(markup).toContain('Tab 1');
    expect(markup).toContain('Tab 2');
  });

  it('only renders the first tab panel content by default', () => {
    const markup = renderToStaticMarkup(
      <Tabs>
        <Tab label="One">
          <span data-testid="one">visible</span>
        </Tab>
        <Tab label="Two">
          <span data-testid="two">hidden</span>
        </Tab>
      </Tabs>
    );

    expect(markup).toContain('data-testid="one"');
    expect(markup).not.toContain('data-testid="two"');
  });

  it('marks the active tab button with aria-selected', () => {
    const markup = renderToStaticMarkup(
      <Tabs>
        <Tab label="One">content</Tab>
        <Tab label="Two">content</Tab>
      </Tabs>
    );

    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-selected="false"');
  });
});
