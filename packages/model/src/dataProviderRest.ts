import { BaseHTTPDataProvider } from './dataProviderBaseHttp';
import { Data, MutableDataProvider, MutableSchemaProvider } from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { assert } from '@diagram-craft/utils/assert';

type DataWithSchema = Data & { _schemaId: string };

export const RestDataProviderId = 'restDataProvider';

export class RESTDataProvider
  extends BaseHTTPDataProvider
  implements MutableDataProvider, MutableSchemaProvider
{
  providerId = RestDataProviderId;

  baseUrl: string | undefined = undefined;

  private readonly fetchTimeout: number = 10000; // 10 seconds default timeout

  constructor(s?: string, autoRefresh = true) {
    super(false);

    if (s) {
      const d = JSON.parse(s);
      this.schemas = d.schemas ?? [];
      this.data = d.data ?? [];
      this.baseUrl = d.baseUrl;
      this.fetchTimeout = d.fetchTimeout ?? 10000;

      if (autoRefresh && d.baseUrl) {
        this.initializeWithAutoRefresh();
      }
    } else {
      this.data = [];
      this.schemas = [];
    }
  }

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
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

    const res = await this.fetchWithTimeout(`${this.baseUrl}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataWithSchema)
    });

    if (!res.ok) {
      throw new Error(`Failed to add data: ${res.statusText}`);
    }

    const createdData = await res.json();
    this.data.push(createdData);
    this.emit('addData', { data: [createdData] });
  }

  async updateData(schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.baseUrl);

    const dataWithSchema: DataWithSchema = { ...data, _schemaId: schema.id };

    const res = await this.fetchWithTimeout(`${this.baseUrl}/data/${data._uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataWithSchema)
    });

    if (!res.ok) {
      throw new Error(`Failed to update data: ${res.statusText}`);
    }

    const updatedData = await res.json();
    const index = this.data.findIndex(d => d._uid === data._uid);
    if (index !== -1) {
      this.data[index] = updatedData;
      this.emit('updateData', { data: [updatedData] });
    }
  }

  async deleteData(_schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.baseUrl);

    const res = await this.fetchWithTimeout(`${this.baseUrl}/data/${data._uid}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      throw new Error(`Failed to delete data: ${res.statusText}`);
    }

    const index = this.data.findIndex(d => d._uid === data._uid);
    if (index !== -1) {
      this.data.splice(index, 1);
      this.emit('deleteData', { data: [data] });
    }
  }

  async addSchema(schema: DataSchema): Promise<void> {
    assert.present(this.baseUrl);

    const res = await this.fetchWithTimeout(`${this.baseUrl}/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    if (!res.ok) {
      throw new Error(`Failed to add schema: ${res.statusText}`);
    }

    const createdSchema = await res.json();
    this.schemas.push(createdSchema);
    this.emit('addSchema', createdSchema);
  }

  async updateSchema(schema: DataSchema): Promise<void> {
    assert.present(this.baseUrl);

    const index = this.schemas.findIndex(s => s.id === schema.id);
    if (index === -1) return; // Schema doesn't exist, do nothing

    const res = await this.fetchWithTimeout(`${this.baseUrl}/schemas/${schema.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    if (!res.ok) {
      throw new Error(`Failed to update schema: ${res.statusText}`);
    }

    const updatedSchema = await res.json();
    this.schemas[index] = updatedSchema;
    this.emit('updateSchema', updatedSchema);
  }

  async deleteSchema(schema: DataSchema): Promise<void> {
    assert.present(this.baseUrl);

    const index = this.schemas.findIndex(s => s.id === schema.id);
    if (index === -1) return; // Schema doesn't exist, do nothing

    const res = await this.fetchWithTimeout(`${this.baseUrl}/schemas/${schema.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      throw new Error(`Failed to delete schema: ${res.statusText}`);
    }

    this.schemas.splice(index, 1);
    this.emit('deleteSchema', schema);
  }

  serialize(): string {
    return JSON.stringify({
      schemas: this.schemas,
      data: this.data,
      baseUrl: this.baseUrl,
      fetchTimeout: this.fetchTimeout
    });
  }

  protected async fetchData(force = true): Promise<DataWithSchema[]> {
    assert.present(this.baseUrl);
    const res = await this.fetchWithTimeout(`${this.baseUrl}/data`, {
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
    const res = await this.fetchWithTimeout(`${this.baseUrl}/schemas`, {
      method: 'GET',
      cache: force ? 'no-cache' : 'default'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch schemas: ${res.statusText}`);
    }

    return res.json();
  }
}
