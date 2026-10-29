import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../../widgetDiscovery';
import { getWidgetDefinitions } from './widgetRegistry';
import { WIDGET_CATEGORIES } from './widgetCategories';
import type { WidgetDefinition } from './types';

const SRC_ROOT = join(__dirname, '..', '..');
const TITLE_PREFIX = 'Widgets/';

/**
 * Storybook reads `title` and `tags` statically, so stories cannot derive them from the registry.
 * This is the single place that says what they must be.
 */
const expectedTags = (definition: WidgetDefinition): string[] => [
  ...(definition.mdx ? ['mdx', definition.mdx.mode] : []),
  ...(definition.dashboard
    ? ['dashboard', ...definition.dashboard.surfaces.map(surface => `${surface}-surface`)]
    : [])
];

const storyFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : storyFiles(path);
    return entry.name.endsWith('.stories.tsx') ? [path] : [];
  });

const widgetStories = storyFiles(SRC_ROOT).flatMap(path => {
  const source = readFileSync(path, 'utf8');
  const title = /title: '((?:[^'\\]|\\.)*)'/.exec(source)?.[1]?.replace(/\\'/g, "'");
  if (!title?.startsWith(TITLE_PREFIX)) return [];
  const tags = /^ {2}tags: \[([^\]]*)\]/m.exec(source)?.[1];
  return [
    {
      path,
      title,
      tags: tags ? [...tags.matchAll(/'([^']+)'/g)].map(match => match[1]) : []
    }
  ];
});

describe('widget stories', () => {
  const definitions = getWidgetDefinitions();
  const categoryLabels = new Map(WIDGET_CATEGORIES.map(c => [c.id, c.label]));

  it('finds widget stories', () => {
    expect(widgetStories.length).toBeGreaterThan(0);
  });

  it.each(widgetStories.map(story => [story.title, story] as const))(
    '%s is grouped by category and tagged from its definition',
    (_title, story) => {
      const [, categoryLabel, ...rest] = story.title.split('/');
      // "Tabs (MDX)" and "Tabs (Dashboard)" disambiguate same-named widgets
      const name = rest.join('/').replace(/ \((?:MDX|Dashboard)\)$/, '');
      const candidates = definitions.filter(
        definition =>
          categoryLabels.get(definition.category) === categoryLabel && definition.name === name
      );
      expect(candidates, `no widget "${name}" in category "${categoryLabel}"`).not.toHaveLength(0);
      expect(candidates.map(expectedTags).map(tags => tags.join(','))).toContain(
        story.tags.join(',')
      );
    }
  );
});
