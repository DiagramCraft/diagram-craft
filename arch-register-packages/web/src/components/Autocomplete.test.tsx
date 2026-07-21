import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';

describe('Autocomplete', () => {
  it('renders an accessible controlled input', () => {
    const markup = renderToStaticMarkup(
      <Autocomplete
        items={[]}
        value=""
        onValueChange={vi.fn()}
        onSelect={vi.fn()}
        getItemKey={item => item}
        getItemLabel={item => item}
        renderItem={item => item}
        placeholder="Search items…"
        ariaLabel="Search items"
        emptyMessage="No items found"
      />
    );

    expect(markup).toContain('aria-label="Search items"');
    expect(markup).toContain('placeholder="Search items…"');
  });
});
