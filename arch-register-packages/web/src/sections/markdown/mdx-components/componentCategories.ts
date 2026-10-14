export type ComponentCategory =
  | 'basic-blocks'
  | 'metrics'
  | 'data-views'
  | 'visualizations'
  | 'content-layout';

export const COMPONENT_CATEGORIES: ReadonlyArray<{
  id: ComponentCategory;
  label: string;
  description: string;
}> = [
  {
    id: 'basic-blocks',
    label: 'Basic blocks',
    description: 'Headings, lists and other Markdown basics'
  },
  { id: 'metrics', label: 'Metrics', description: 'Single numbers and counts at a glance' },
  { id: 'data-views', label: 'Data views', description: 'Tables, lists and queues of records' },
  {
    id: 'visualizations',
    label: 'Visualizations',
    description: 'Charts, graphs, calendars and diagrams'
  },
  {
    id: 'content-layout',
    label: 'Content & layout',
    description: 'Text, media and ways to arrange other widgets'
  }
];

type Categorized<T> = { category: ComponentCategory; items: T[] };

/** Groups items in shared category order, omitting categories with no entries. */
export const groupByCategory = <T>(
  items: ReadonlyArray<T>,
  categoryOf: (item: T) => ComponentCategory
): Array<Categorized<T> & { label: string; description: string }> =>
  COMPONENT_CATEGORIES.flatMap(category => {
    const inCategory = items.filter(item => categoryOf(item) === category.id);
    return inCategory.length === 0
      ? []
      : [
          {
            category: category.id,
            label: category.label,
            description: category.description,
            items: inCategory
          }
        ];
  });

/** Case-insensitive match on label, description and optional keywords. */
export const matchesCatalogSearch = (
  query: string,
  entry: { label: string; description: string; keywords?: string[] }
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return (
    entry.label.toLowerCase().includes(normalizedQuery) ||
    entry.description.toLowerCase().includes(normalizedQuery) ||
    (entry.keywords?.some(keyword => keyword.toLowerCase().includes(normalizedQuery)) ?? false)
  );
};
