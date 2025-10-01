import { UndoableAction, UndoManager } from './undoManager';
import { UnitOfWork } from './unitOfWork';
import { DataManager } from './diagramDocumentData';
import { Data } from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { deepClone } from '@diagram-craft/utils/object';

export class AddSchemaUndoableAction implements UndoableAction {
  description: string;

  constructor(
    private readonly dataManager: DataManager,
    private readonly schema: DataSchema,
    private readonly providerId: string
  ) {
    this.description = `Add schema "${schema.name}"`;
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.deleteSchema(this.schema);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.addSchema(this.schema, this.providerId);
  }
}

export class UpdateSchemaUndoableAction implements UndoableAction {
  description: string;
  private readonly beforeSchema: DataSchema;
  private readonly afterSchema: DataSchema;

  constructor(
    private readonly dataManager: DataManager,
    beforeSchema: DataSchema,
    afterSchema: DataSchema
  ) {
    this.description = `Update schema "${afterSchema.name}"`;
    this.beforeSchema = deepClone(beforeSchema);
    this.afterSchema = deepClone(afterSchema);
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.updateSchema(this.beforeSchema);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.updateSchema(this.afterSchema);
  }
}

export class DeleteSchemaUndoableAction implements UndoableAction {
  description: string;

  constructor(
    private readonly dataManager: DataManager,
    private readonly schema: DataSchema,
    private readonly providerId: string
  ) {
    this.description = `Delete schema "${schema.name}"`;
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.addSchema(this.schema, this.providerId);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.deleteSchema(this.schema);
  }
}

export class AddDataUndoableAction implements UndoableAction {
  description: string;

  constructor(
    private readonly dataManager: DataManager,
    private readonly schema: DataSchema,
    private readonly data: Data
  ) {
    this.description = `Add data to "${schema.name}"`;
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.deleteData(this.schema, this.data);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.addData(this.schema, this.data);
  }
}

export class UpdateDataUndoableAction implements UndoableAction {
  description: string;
  private readonly beforeData: Data;
  private readonly afterData: Data;

  constructor(
    private readonly dataManager: DataManager,
    private readonly schema: DataSchema,
    beforeData: Data,
    afterData: Data
  ) {
    this.description = `Update data in "${schema.name}"`;
    this.beforeData = deepClone(beforeData);
    this.afterData = deepClone(afterData);
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.updateData(this.schema, this.beforeData);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.updateData(this.schema, this.afterData);
  }
}

export class DeleteDataUndoableAction implements UndoableAction {
  description: string;

  constructor(
    private readonly dataManager: DataManager,
    private readonly schema: DataSchema,
    private readonly data: Data
  ) {
    this.description = `Delete data from "${schema.name}"`;
  }

  undo(_uow: UnitOfWork): void {
    void this.dataManager.addData(this.schema, this.data);
  }

  redo(_uow: UnitOfWork): void {
    void this.dataManager.deleteData(this.schema, this.data);
  }
}

export class DataManagerUndoableFacade {
  constructor(
    private readonly undoManager: UndoManager,
    private readonly dataManager: DataManager
  ) {}

  async addSchema(schema: DataSchema, providerId: string): Promise<void> {
    if (this.dataManager.supportsUndo(providerId)) {
      const action = new AddSchemaUndoableAction(this.dataManager, schema, providerId);
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.addSchema(schema, providerId);
    }
  }

  async updateSchema(beforeSchema: DataSchema, afterSchema: DataSchema): Promise<void> {
    if (this.dataManager.supportsUndo(afterSchema.providerId)) {
      const action = new UpdateSchemaUndoableAction(
        this.dataManager,
        beforeSchema,
        afterSchema
      );
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.updateSchema(afterSchema);
    }
  }

  async deleteSchema(schema: DataSchema): Promise<void> {
    if (this.dataManager.supportsUndo(schema.providerId)) {
      const action = new DeleteSchemaUndoableAction(
        this.dataManager,
        schema,
        schema.providerId
      );
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.deleteSchema(schema);
    }
  }

  async addData(schema: DataSchema, data: Data): Promise<void> {
    if (this.dataManager.supportsUndo(schema.providerId)) {
      const action = new AddDataUndoableAction(this.dataManager, schema, data);
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.addData(schema, data);
    }
  }

  async updateData(schema: DataSchema, beforeData: Data, afterData: Data): Promise<void> {
    if (this.dataManager.supportsUndo(schema.providerId)) {
      const action = new UpdateDataUndoableAction(this.dataManager, schema, beforeData, afterData);
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.updateData(schema, afterData);
    }
  }

  async deleteData(schema: DataSchema, data: Data): Promise<void> {
    if (this.dataManager.supportsUndo(schema.providerId)) {
      const action = new DeleteDataUndoableAction(this.dataManager, schema, data);
      this.undoManager.addAndExecute(action);
    } else {
      await this.dataManager.deleteData(schema, data);
    }
  }
}
