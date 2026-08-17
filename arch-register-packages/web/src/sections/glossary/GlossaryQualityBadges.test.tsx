import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlossaryQualityBadges } from './GlossaryQualityBadges';

const quality = (
  overrides: Partial<Record<'unused' | 'conflicting' | 'deprecated' | 'ownerless', boolean>>
) => ({
  unused: false,
  conflicting: false,
  deprecated: false,
  ownerless: false,
  ...overrides
});

describe('GlossaryQualityBadges', () => {
  it('renders nothing when no quality flags are set', () => {
    const html = renderToStaticMarkup(<GlossaryQualityBadges quality={quality({})} />);
    expect(html).toBe('');
  });

  it('renders one badge per active flag with a descriptive title', () => {
    const html = renderToStaticMarkup(
      <GlossaryQualityBadges quality={quality({ conflicting: true, ownerless: true })} />
    );
    expect(html).toContain('Conflicts with another term');
    expect(html).toContain('No owner assigned');
    expect(html).not.toContain('Deprecated lifecycle');
    expect(html).not.toContain('No visible usage found');
  });

  it('renders all four badges when every flag is set', () => {
    const html = renderToStaticMarkup(
      <GlossaryQualityBadges
        quality={quality({ unused: true, conflicting: true, deprecated: true, ownerless: true })}
      />
    );
    expect(html).toContain('Deprecated lifecycle');
    expect(html).toContain('No visible usage found');
  });
});
