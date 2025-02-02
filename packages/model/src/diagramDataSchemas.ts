import { DiagramDocument } from './diagramDocument';
import { UnitOfWork } from './unitOfWork';
import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';
import { deepClone } from '@diagram-craft/utils/object';

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

export class DiagramDataSchemas {
  #schemas: DataSchema[] = [];

  constructor(
    private readonly document: DiagramDocument,
    schemas?: DataSchema[]
  ) {
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

  addSchema(schema: DataSchema) {
    if (this.#schemas.find(s => s.id === schema.id)) {
      this.changeSchema(schema);
    } else {
      this.#schemas.push(schema);
    }
  }

  removeSchema(schema: DataSchema, uow: UnitOfWork) {
    const idx = this.#schemas.indexOf(schema);
    if (idx !== -1) {
      this.#schemas.splice(idx, 1);
    }

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

  changeSchema(schema: DataSchema) {
    const dest = this.get(schema.id);
    dest.name = schema.name;
    dest.fields = schema.fields;
  }
}

export class DeleteSchemaUndoableAction implements UndoableAction {
  description = 'Delete schema';

  constructor(
    private readonly diagram: Diagram,
    private readonly schema: DataSchema
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.schemas.removeSchema(this.schema, uow);
  }

  redo() {
    this.diagram.document.schemas.addSchema(this.schema);
  }
}

export class AddSchemaUndoableAction implements UndoableAction {
  description = 'Add schema';

  constructor(
    private readonly diagram: Diagram,
    private readonly schema: DataSchema
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.schemas.removeSchema(this.schema, uow);
  }

  redo() {
    this.diagram.document.schemas.addSchema(this.schema);
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
    this.oldSchema = deepClone(this.diagram.document.schemas.get(schema.id));
  }

  undo() {
    this.diagram.document.schemas.changeSchema(this.oldSchema);
  }

  redo() {
    this.diagram.document.schemas.changeSchema(this.schema);
  }
}
