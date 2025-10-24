import type { DiagramDocument } from './diagramDocument';
import { UnitOfWork } from './unitOfWork';
import { deepClone } from '@diagram-craft/utils/object';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import type { CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';

export type DataSchemaField =
  | {
      id: string;
      name: string;
      type: 'text' | 'longtext';
    }
  | {
      id: string;
      name: string;
      type: 'reference';
      schemaId: string;
      minCount: number;
      maxCount: number;
    };

export const encodeDataReferences = (refs: string[]) => refs.join(',');
export const decodeDataReferences = (refs: string | undefined) =>
  refs === undefined || refs.length === 0 ? [] : refs.split(',');

export type DataSchema = {
  id: string;
  name: string;
  providerId: string;
  fields: DataSchemaField[];
};

export type SchemaMetadata = {
  availableForElementLocalData?: boolean;
  useDocumentOverrides?: boolean;
};

type DiagramDocumentDataSchemasEvents = {
  update: { schema: DataSchema };
  add: { schema: DataSchema };
  remove: { schema: DataSchema };
};

export class DiagramDocumentDataSchemas extends EventEmitter<DiagramDocumentDataSchemasEvents> {
  readonly #schemas: CRDTMap<Record<string, DataSchema>>;
  readonly #schemaMetadata: CRDTMap<Record<string, SchemaMetadata>>;

  constructor(
    private readonly root: CRDTRoot,
    private readonly document: DiagramDocument,
    schemas?: DataSchema[]
  ) {
    super();

    this.#schemas = root.getMap('schemas');
    this.#schemaMetadata = root.getMap('schemaMetadata');

    this.#schemas.on('remoteUpdate', p => this.emit('update', { schema: p.value }));
    this.#schemas.on('remoteDelete', p => this.emit('remove', { schema: p.value }));
    this.#schemas.on('remoteInsert', p => this.emit('add', { schema: p.value }));

    this.#schemaMetadata.on('remoteUpdate', p => this.emit('update', { schema: this.get(p.key) }));
    this.#schemaMetadata.on('remoteInsert', p => this.emit('update', { schema: this.get(p.key) }));

    if (this.all.length === 0 && schemas) {
      this.replaceBy(schemas);
    }
  }

  get all() {
    return Array.from(this.#schemas.values());
  }

  get(id: string) {
    return this.#schemas.get(id) ?? { id: '', name: '', providerId: 'document', fields: [] };
  }

  has(id: string) {
    return this.#schemas.has(id);
  }

  add(schema: DataSchema) {
    const isNew = !this.#schemas.has(schema.id);
    if (!isNew) {
      this.update(schema);
      this.emit('update', { schema });
    } else {
      this.#schemas.set(schema.id, schema);
      this.emit('add', { schema });
    }
  }

  private remove(schema: DataSchema) {
    if (!this.#schemas.has(schema.id)) return;
    this.#schemas.delete(schema.id);
    this.#schemaMetadata.delete(schema.id);
    this.emit('remove', { schema });
  }

  // TODO: Add unit tests
  removeAndClearUsage(schema: DataSchema, uow: UnitOfWork) {
    this.remove(schema);

    for (const diagram of this.document.diagramIterator({ nest: true })) {
      for (const e of diagram.allElements()) {
        if (e.metadata.data?.data?.find(d => d.schema === schema.id)) {
          e.updateMetadata(props => {
            props.data ??= {};
            props.data.data ??= [];
            props.data.data = props.data.data.filter(d => d.schema !== schema.id);
          }, uow);
        }
      }
    }
  }

  update(schema: DataSchema) {
    const clonedSchema = deepClone(schema);

    const dest = this.get(clonedSchema.id);
    dest.name = clonedSchema.name;
    dest.fields = clonedSchema.fields;
    this.#schemas.set(dest.id, clonedSchema);
    this.emit('update', { schema: clonedSchema });
  }

  replaceBy(schemas: DataSchema[]) {
    this.root.transact(() => {
      this.#schemas.clear();
      for (const template of schemas) {
        this.#schemas.set(template.id, template);
      }
      // TODO: Should we emit events here?
    });
  }

  getMetadata(schemaId: string): SchemaMetadata {
    return (
      this.#schemaMetadata.get(schemaId) ?? {
        availableForElementLocalData: false,
        useDocumentOverrides: false
      }
    );
  }

  setMetadata(schemaId: string, metadata: SchemaMetadata) {
    const schema = this.get(schemaId);
    assert.present(schema);

    this.#schemaMetadata.set(schemaId, metadata);
    this.emit('update', { schema });
  }
}
