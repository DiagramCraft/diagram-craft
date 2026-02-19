export type CollectionInfo = {
  name: string;
  total: number;
  category?: string;
};

export type CollectionIcons = {
  categories?: Record<string, string[]>;
  uncategorized?: string[];
};

export interface IconService {
  /** Returns all available icon collections keyed by prefix */
  getCollections(): Promise<Record<string, CollectionInfo>>;

  /** Returns the icon names within a single collection, grouped by subcategory */
  getCollectionIcons(prefix: string): Promise<CollectionIcons>;

  /** Returns the URL to render a single icon as an SVG image */
  getIconUrl(prefix: string, icon: string): string;
}
