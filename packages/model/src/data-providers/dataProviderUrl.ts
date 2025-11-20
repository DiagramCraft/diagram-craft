import { BaseHTTPDataProvider } from './dataProviderBaseHttp';
import { type DataWithSchema } from '../dataProvider';
import { DataSchema } from '../diagramDocumentDataSchemas';
import { assert } from '@diagram-craft/utils/assert';

export const UrlDataProviderId = 'urlDataProvider';

export class UrlDataProvider extends BaseHTTPDataProvider {
  providerId = UrlDataProviderId;

  dataUrl: string | undefined = undefined;
  schemaUrl: string | undefined = undefined;

  constructor(s?: string, autoRefresh = true) {
    super(false);

    if (s) {
      const d = JSON.parse(s);
      this.schemas = d.schemas ?? [];
      this.data = d.data ?? [];
      this.schemaUrl = d.schemaUrl;
      this.dataUrl = d.dataUrl;

      if (autoRefresh) {
        this.initializeWithAutoRefresh();
      }
    } else {
      this.data = [];
      this.schemas = [];
    }
  }

  async verifySettings(): Promise<string | undefined> {
    try {
      await this.fetchSchemas(true);
      await this.fetchData(true);
    } catch (e) {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      return `Error fetching data: ${(e as any).toString()}`;
    }
  }

  serialize(): string {
    return JSON.stringify({
      schemas: this.schemas ?? [],
      data: this.data ?? [],
      dataUrl: this.dataUrl,
      schemaUrl: this.schemaUrl
    });
  }

  protected async fetchData(force = true): Promise<DataWithSchema[]> {
    assert.present(this.dataUrl);
    const res = await fetch(this.dataUrl, {
      cache: force ? 'no-cache' : 'default'
    });
    return res.json() as Promise<DataWithSchema[]>;
  }

  protected async fetchSchemas(force = true): Promise<DataSchema[]> {
    assert.present(this.schemaUrl);
    const res = await fetch(this.schemaUrl, {
      cache: force ? 'no-cache' : 'default'
    });
    return res.json() as Promise<DataSchema[]>;
  }
}
