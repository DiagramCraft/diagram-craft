export type CollectionInfo = {
  name: string;
  total: number;
  category?: string;
};

export type CollectionIcons = {
  categories?: Record<string, string[]>;
  uncategorized?: string[];
};

export type SearchResult = {
  icons: string[];
  total: number;
};

/** Flattens a CollectionIcons response into a single array of icon names. */
export const flattenIcons = (data: CollectionIcons): string[] => {
  const entries: string[] = [];
  if (data.categories) {
    for (const icons of Object.values(data.categories)) {
      entries.push(...icons);
    }
  }
  if (data.uncategorized) {
    entries.push(...data.uncategorized);
  }
  return entries;
};

export interface IconService {
  /** Returns all available icon collections keyed by prefix */
  getCollections(): Promise<Record<string, CollectionInfo>>;

  /** Returns the icon names within a single collection, grouped by subcategory */
  getCollectionIcons(prefix: string): Promise<CollectionIcons>;

  /** Searches icons by query, returning names in "prefix:name" format */
  searchIcons(query: string, limit?: number): Promise<SearchResult>;

  /** Returns the URL to render a single icon as an SVG image */
  getIconUrl(prefix: string, icon: string, color: string): string;

  /** Fetches the raw SVG text for an icon using currentColor */
  fetchIconSvg(prefix: string, icon: string): Promise<string>;
}
