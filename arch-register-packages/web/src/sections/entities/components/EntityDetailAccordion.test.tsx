import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityDetailAccordion } from './EntityDetailAccordion';

describe('EntityDetailAccordion', () => {
  it('opens only the configured sections by default', () => {
    const markup = renderToStaticMarkup(
      <EntityDetailAccordion defaultOpen={['metadata']}>
        <EntityDetailAccordion.Section value="metadata" title="Metadata">
          Metadata content
        </EntityDetailAccordion.Section>
        <EntityDetailAccordion.Section value="projects" title="Projects" count={2}>
          Project content
        </EntityDetailAccordion.Section>
      </EntityDetailAccordion>
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Projects');
    expect(markup).toContain('(2)');
    expect(markup).toContain('hidden=""');
  });
});
