import { DiagramDocument } from './diagramDocument';
import { UnitOfWork } from './unitOfWork';
import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';
import { deepClone } from '@diagram-craft/utils/object';
import { EventEmitter } from '@diagram-craft/utils/event';

type DataSchemaField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type DataSchema = {
  id: string;
  name: string;
  source: 'document' | 'external';
  fields: DataSchemaField[];
};

export class DiagramDocumentDataSchemas extends EventEmitter<{
  update: { schema: DataSchema };
  add: { schema: DataSchema };
  remove: { schema: DataSchema };
}> {
  #schemas: DataSchema[] = [];

  constructor(
    private readonly document: DiagramDocument,
    schemas?: DataSchema[]
  ) {
    super();
    this.#schemas = schemas ?? [];
  }

  get all() {
    return this.#schemas;
  }

  get(id: string) {
    return (
      this.#schemas.find(s => s.id === id) ?? { id: '', name: '', source: 'document', fields: [] }
    );
  }

  has(id: string) {
    return this.#schemas.find(s => s.id === id);
  }

  add(schema: DataSchema) {
    if (this.#schemas.find(s => s.id === schema.id)) {
      this.update(schema);
      this.emit('update', { schema });
    } else {
      this.#schemas.push(schema);
      this.emit('add', { schema });
    }
  }

  /**
   * @deprecated Avoid using as it doesn't clear usage of schema in existing elements.
   *             Please use removeAndClearUsage instead
   * @param schema
   */
  remove(schema: DataSchema) {
    const idx = this.#schemas.indexOf(schema);
    if (idx !== -1) {
      this.#schemas.splice(idx, 1);
      this.emit('remove', { schema });
    }
  }

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
    const dest = this.get(schema.id);
    dest.name = schema.name;
    dest.fields = schema.fields;
    this.emit('update', { schema });
  }
}

export class DeleteSchemaUndoableAction implements UndoableAction {
  description = 'Delete schema';

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
