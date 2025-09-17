import type { DiagramDocument } from './diagramDocument';
import { UnitOfWork } from './unitOfWork';
import type { UndoableAction } from './undoManager';
import type { Diagram } from './diagram';
import { deepClone } from '@diagram-craft/utils/object';
import { EventEmitter } from '@diagram-craft/utils/event';
import { CRDTMap, CRDTRoot } from './collaboration/crdt';

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

export type DataSchema = {
  id: string;
  name: string;
  source: 'document' | 'external';
  fields: DataSchemaField[];
};

type DiagramDocumentDataSchemasEvents = {
  update: { schema: DataSchema };
  add: { schema: DataSchema };
  remove: { schema: DataSchema };
};

export class DiagramDocumentDataSchemas extends EventEmitter<DiagramDocumentDataSchemasEvents> {
  readonly #schemas: CRDTMap<Record<string, DataSchema>>;

  constructor(
    private readonly root: CRDTRoot,
    private readonly document: DiagramDocument,
    schemas?: DataSchema[]
  ) {
    super();

    this.#schemas = root.getMap('schemas');

    this.#schemas.on('remoteUpdate', p => this.emit('update', { schema: p.value }));
    this.#schemas.on('remoteDelete', p => this.emit('remove', { schema: p.value }));
    this.#schemas.on('remoteInsert', p => this.emit('add', { schema: p.value }));

    if (this.all.length === 0 && schemas) {
      this.replaceBy(schemas);
    }
  }

  get all() {
    return Array.from(this.#schemas.values());
  }

  get(id: string) {
    return this.#schemas.get(id) ?? { id: '', name: '', source: 'document', fields: [] };
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
}

export class DeleteSchemaUndoableAction implements UndoableAction {
  description = 'Delete schema';

  constructor(
    private readonly diagram: Diagram,
    private readonly schema: DataSchema
  ) {}

  undo() {
    this.diagram.document.data.schemas.add(this.schema);
  }

  redo(uow: UnitOfWork) {
    this.diagram.document.data.schemas.removeAndClearUsage(this.schema, uow);
  }
}

export class AddSchemaUndoableAction implements UndoableAction {
  description = 'Add schema';

  constructor(
    private readonly diagram: Diagram,
    private readonly schema: DataSchema
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.data.schemas.removeAndClearUsage(this.schema, uow);
  }

  redo() {
    this.diagram.document.data.schemas.add(this.schema);
  }
}

export class ModifySchemaUndoableAction implements UndoableAction {
  description = 'Modify schema';

  private readonly oldSchema: DataSchema;
  private readonly schema: DataSchema;

  constructor(
    private readonly diagram: Diagram,
    schema: DataSchema
  ) {
    this.schema = deepClone(schema);
    this.oldSchema = deepClone(this.diagram.document.data.schemas.get(schema.id));
  }

  undo() {
    this.diagram.document.data.schemas.update(this.oldSchema);
  }

  redo() {
    this.diagram.document.data.schemas.update(this.schema);
  }
}
