import type { CollectionIcons, CollectionInfo, IconService, SearchResult } from './IconService';

const BASE_URL = 'https://api.iconify.design';

export class IconifyIconService implements IconService {
  async getCollections(): Promise<Record<string, CollectionInfo>> {
    const res = await fetch(`${BASE_URL}/collections`);
    return res.json() as Promise<Record<string, CollectionInfo>>;
  }

  async getCollectionIcons(prefix: string): Promise<CollectionIcons> {
    const res = await fetch(`${BASE_URL}/collection?prefix=${encodeURIComponent(prefix)}`);
    return res.json() as Promise<CollectionIcons>;
  }

  async searchIcons(query: string, limit = 200): Promise<SearchResult> {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    const data = (await res.json()) as { icons: string[]; total: number };
    return { icons: data.icons, total: data.total };
  }

  getIconUrl(prefix: string, icon: string): string {
    return `${BASE_URL}/${prefix}/${icon}.svg?color=%23fefefe`;
  }
}
