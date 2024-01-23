import { DiagramDocument } from './diagramDocument.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { UndoableAction } from './undoManager.ts';
import { Diagram } from './diagram.ts';
import { deepClone } from '../utils/object.ts';

type DataSchemaField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type DataSchema = {
  id: string;
  name: string;
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
    return this.#schemas.find(s => s.id === id) ?? { id: '', name: '', fields: [] };
  }

  addSchema(schema: DataSchema) {
    this.#schemas.push(schema);
  }

  removeSchema(schema: DataSchema, uow: UnitOfWork) {
    const idx = this.#schemas.indexOf(schema);
    if (idx !== -1) {
      this.#schemas.splice(idx, 1);
    }

    for (const diagram of this.document.diagrams) {
      for (const node of diagram.nodeLookup.values()) {
        if (node.props.data?.schema === schema.id) {
          node.updateProps(props => {
            delete props.data?.schema;
          }, uow);
        }
      }
      for (const edge of diagram.edgeLookup.values()) {
        if (edge.props.data?.schema === schema.id) {
          edge.updateProps(props => {
            delete props.data?.schema;
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
    // eslint-disable-next-line
    private readonly schema: DataSchema
  ) {}

  undo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.diagram.document.schemas.removeSchema(this.schema, uow);
    });
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

  undo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.diagram.document.schemas.removeSchema(this.schema, uow);
    });
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
