import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  test('renders title, actions and children when open', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection title="Config" open onOpenChange={() => {}} actions={<i>act</i>}>
        <p>body</p>
      </CollapsibleSection>
    );
    expect(html).toContain('Config');
    expect(html).toContain('act');
    expect(html).toContain('body');
    expect(html).toContain('aria-expanded="true"');
  });

  test('hides the body when closed', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection title="Config" open={false} onOpenChange={() => {}}>
        <p>body</p>
      </CollapsibleSection>
    );
    expect(html).not.toContain('body');
    expect(html).toContain('aria-expanded="false"');
  });
});
