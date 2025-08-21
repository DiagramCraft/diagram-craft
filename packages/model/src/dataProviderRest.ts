import { BaseHTTPDataProvider } from './dataProviderBaseHttp';
import { Data, MutableDataProvider } from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { assert } from '@diagram-craft/utils/assert';

type DataWithSchema = Data & { _schemaId: string };

export const RestDataProviderId = 'restDataProvider';

export class RESTDataProvider extends BaseHTTPDataProvider implements MutableDataProvider {
  id = RestDataProviderId;

  baseUrl: string | undefined = undefined;

  constructor(s?: string, autoRefresh = true) {
    super(false);

    if (s) {
      const d = JSON.parse(s);
      this.schemas = d.schemas ?? [];
      this.data = d.data ?? [];
      this.baseUrl = d.baseUrl;

      if (autoRefresh && d.baseUrl) {
        this.initializeWithAutoRefresh();
      }
    } else {
      this.data = [];
      this.schemas = [];
    }
  }

  async verifySettings(): Promise<string | undefined> {
    if (!this.baseUrl) return 'Base URL required.';
    try {
      await this.fetchSchemas(true);
      await this.fetchData(true);
    } catch (e) {
      return 'Error fetching data: ' + (e as Error).toString();
    }
  }

  async addData(schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.baseUrl);

    const dataWithSchema: DataWithSchema = { ...data, _schemaId: schema.id };

    const response = await fetch(`${this.baseUrl}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataWithSchema)
    });

    if (!response.ok) {
      throw new Error(`Failed to add data: ${response.statusText}`);
    }

    const createdData = await response.json();
    this.data.push(createdData);
    this.emit('addData', { data: [createdData] });
  }

  async updateData(schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.baseUrl);

    const dataWithSchema: DataWithSchema = { ...data, _schemaId: schema.id };

    const response = await fetch(`${this.baseUrl}/data/${data._uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataWithSchema)
    });

    if (!response.ok) {
      throw new Error(`Failed to update data: ${response.statusText}`);
    }

    const updatedData = await response.json();
    const index = this.data.findIndex(d => d._uid === data._uid);
    if (index !== -1) {
      this.data[index] = updatedData;
      this.emit('updateData', { data: [updatedData] });
    }
  }

  async deleteData(_schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.baseUrl);

    const response = await fetch(`${this.baseUrl}/data/${data._uid}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete data: ${response.statusText}`);
    }

    const index = this.data.findIndex(d => d._uid === data._uid);
    if (index !== -1) {
      this.data.splice(index, 1);
      this.emit('deleteData', { data: [data] });
    }
  }

  serialize(): string {
    return JSON.stringify({
      schemas: this.schemas,
      data: this.data,
      baseUrl: this.baseUrl
    });
  }

  protected async fetchData(force = true): Promise<DataWithSchema[]> {
    assert.present(this.baseUrl);
    const res = await fetch(`${this.baseUrl}/data`, {
      method: 'GET',
      cache: force ? 'no-cache' : 'default'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.statusText}`);
    }

    return res.json();
  }

  protected async fetchSchemas(force = true): Promise<DataSchema[]> {
    assert.present(this.baseUrl);
    const res = await fetch(`${this.baseUrl}/schemas`, {
      method: 'GET',
      cache: force ? 'no-cache' : 'default'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch schemas: ${res.statusText}`);
    }

    return res.json();
  }
}
