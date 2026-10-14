import { describe, expect, it } from 'vitest';
import '../../../componentDiscovery';
import {
  MDX_SLASH_COMMANDS,
  BUILTIN_SLASH_COMMANDS,
  SLASH_COMMANDS
} from '../editor/PlateMarkdownEditorSlashCommands';
import { getComponentDefinitions, getMdxSpecsForSurface } from './componentRegistry';
import {
  COMPONENT_CATEGORIES,
  groupByCategory,
  matchesCatalogSearch,
  type ComponentCategory
} from './componentCategories';

const categoryIds = new Set(COMPONENT_CATEGORIES.map(category => category.id));

describe('component catalog', () => {
  it('has a valid category and unique type for every component definition', () => {
    const definitions = getComponentDefinitions();
    expect(definitions.every(definition => categoryIds.has(definition.category))).toBe(true);
    const types = definitions.map(definition => definition.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('categorises every dashboard widget', () => {
    const widgets = getComponentDefinitions('dashboardWidget');
    expect(widgets.every(widget => categoryIds.has(widget.category))).toBe(true);
    const labels = widgets.map(widget => widget.dashboardWidget.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const { dashboardWidget } of widgets)
      expect(dashboardWidget.description.trim()).not.toBe('');
  });

  it('offers only wiki-eligible MDX components in the slash menu', () => {
    const wikiLabels = new Set(
      Object.values(getMdxSpecsForSurface('wiki')).map(spec => spec.editorSpec?.slashCommand?.label)
    );
    for (const command of MDX_SLASH_COMMANDS) expect(wikiLabels.has(command.label)).toBe(true);
    expect(MDX_SLASH_COMMANDS.every(command => categoryIds.has(command.category))).toBe(true);
  });

  it('places native Markdown commands under Basic blocks', () => {
    expect(BUILTIN_SLASH_COMMANDS.length).toBeGreaterThan(0);
    expect(BUILTIN_SLASH_COMMANDS.every(command => command.category === 'basic-blocks')).toBe(true);
    expect(SLASH_COMMANDS.slice(0, BUILTIN_SLASH_COMMANDS.length)).toEqual(BUILTIN_SLASH_COMMANDS);
  });

  it('has unique slash command keys', () => {
    const keys = SLASH_COMMANDS.map(command => command.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('groupByCategory', () => {
  const categoryOf = (item: { category: ComponentCategory }) => item.category;

  it('orders groups by shared category order and omits empty categories', () => {
    const groups = groupByCategory(
      [{ category: 'content-layout' }, { category: 'metrics' }, { category: 'metrics' }],
      categoryOf
    );
    expect(groups.map(group => [group.category, group.items.length])).toEqual([
      ['metrics', 2],
      ['content-layout', 1]
    ]);
  });
});

describe('matchesCatalogSearch', () => {
  const entry = { label: 'Entity table', description: 'Filtered rows', keywords: ['grid'] };

  it('matches everything on an empty query', () => {
    expect(matchesCatalogSearch('  ', entry)).toBe(true);
  });

  it('matches label, description and keywords case-insensitively', () => {
    expect(matchesCatalogSearch('TABLE', entry)).toBe(true);
    expect(matchesCatalogSearch('rows', entry)).toBe(true);
    expect(matchesCatalogSearch('Grid', entry)).toBe(true);
    expect(matchesCatalogSearch('chart', entry)).toBe(false);
  });
});
