type DataSchemaField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

type DataSchema = {
  id: string;
  name: string;
  fields: DataSchemaField[];
};

export class DiagramDataSchemas {
  #schemas: DataSchema[] = [];

  constructor(schemas?: DataSchema[]) {
    this.#schemas = schemas ?? [];
  }

  get all() {
    return this.#schemas;
  }

  get(id: string) {
    return this.#schemas.find(s => s.id === id) ?? { id: '', name: '', fields: [] };
  }

  addSchema(schema: DataSchema) {
    this.#schemas.push(schema);
  }

  removeSchema(schema: DataSchema) {
    const idx = this.#schemas.indexOf(schema);
    if (idx !== -1) {
      this.#schemas.splice(idx, 1);
    }
  }

  changeSchema(_schema: DataSchema) {
    // Do nothing
  }
}
