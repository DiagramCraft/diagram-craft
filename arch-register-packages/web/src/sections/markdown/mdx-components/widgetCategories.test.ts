import { describe, expect, it } from 'vitest';
import { getMdxSpecsForSurface } from './mdxRegistry';
import { getDashboardWidgetSpecs } from '../../dashboard/dashboardWidgetRegistry';
import {
  groupByCategory,
  matchesWidgetSearch,
  WIDGET_CATEGORY_BY_TYPE,
  type WidgetCategory
} from './widgetCategories';
import { MDX_SLASH_COMMANDS, SLASH_COMMANDS } from '../editor/PlateMarkdownEditorSlashCommands';

describe('widget catalog', () => {
  it('categorises every dashboard widget', () => {
    const missing = getDashboardWidgetSpecs()
      .map(w => w.type)
      .filter(type => !(type in WIDGET_CATEGORY_BY_TYPE));
    expect(missing).toEqual([]);
  });

  it('categorises every wiki widget that has a slash command', () => {
    const missing = Object.entries(getMdxSpecsForSurface('wiki'))
      .filter(([, spec]) => spec.editorSpec?.slashCommand)
      .map(([type]) => type)
      .filter(type => !(type in WIDGET_CATEGORY_BY_TYPE));
    expect(missing).toEqual([]);
  });

  it('gives dashboard widgets unique, described labels', () => {
    const specs = getDashboardWidgetSpecs();
    const labels = specs.map(w => w.spec.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const { spec } of specs) expect(spec.description.trim()).not.toBe('');
  });

  it('only offers wiki-eligible widgets in the slash menu', () => {
    const wikiLabels = new Set(
      Object.values(getMdxSpecsForSurface('wiki')).map(s => s.editorSpec?.slashCommand?.label)
    );
    for (const cmd of MDX_SLASH_COMMANDS) expect(wikiLabels.has(cmd.label)).toBe(true);
  });

  it('has unique slash command keys', () => {
    const keys = SLASH_COMMANDS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('groupByCategory', () => {
  const cat = (x: { c: WidgetCategory }) => x.c;

  it('orders groups by category order and drops empty ones', () => {
    const groups = groupByCategory(
      [{ c: 'content-layout' }, { c: 'metrics' }, { c: 'metrics' }] as { c: WidgetCategory }[],
      cat
    );
    expect(groups.map(g => [g.category, g.items.length])).toEqual([
      ['metrics', 2],
      ['content-layout', 1]
    ]);
  });
});

describe('matchesWidgetSearch', () => {
  const entry = { label: 'Entity table', description: 'Filtered rows', keywords: ['grid'] };

  it('matches everything on an empty query', () => {
    expect(matchesWidgetSearch('  ', entry)).toBe(true);
  });

  it('matches label, description and keywords case-insensitively', () => {
    expect(matchesWidgetSearch('TABLE', entry)).toBe(true);
    expect(matchesWidgetSearch('rows', entry)).toBe(true);
    expect(matchesWidgetSearch('Grid', entry)).toBe(true);
    expect(matchesWidgetSearch('chart', entry)).toBe(false);
  });
});
