import { Data, DataProvider } from './dataProvider';
import { DataSchema, DiagramDocumentDataSchemas } from './diagramDocumentDataSchemas';
import { DiagramDocument } from './diagramDocument';
import { DiagramDocumentDataTemplates } from './diagramDocumentDataTemplates';
import { UnitOfWork } from './unitOfWork';
import { deepEquals } from '@diagram-craft/utils/object';

const byUid = (uid: string) => (dt: ElementDataEntry) =>
  dt.type === 'external' && dt.external?.uid === uid;

export class DiagramDocumentData {
  #document: DiagramDocument;

  #provider: DataProvider | undefined;

  // TODO: To be loaded from file
  #schemas: DiagramDocumentDataSchemas;

  #templates: DiagramDocumentDataTemplates;

  #dataProviderUpdateDataListener = (data: { data: Data[] }) => {
    for (const d of this.#document.diagramIterator({ nest: true })) {
      const uow = new UnitOfWork(d);
      for (const e of d.allElements()) {
        const externalData = e.metadata.data?.data?.filter(d => d.type === 'external') ?? [];
        if (externalData.length === 0) continue;

        for (const dt of data.data) {
          const predicate = byUid(dt._uid);
          const existing = externalData.find(predicate);
          if (existing && !deepEquals<unknown>(existing, dt)) {
            e.updateMetadata(cb => {
              const toUpdate = cb.data!.data!.find(predicate)!;
              toUpdate.data = dt;
            }, uow);
          }
        }
      }
      uow.commit();
    }
  };

  #dataProviderDeleteDataListener = (data: { data: Data[] }) => {
    for (const d of this.#document.diagramIterator({ nest: true })) {
      const uow = new UnitOfWork(d);
      for (const e of d.allElements()) {
        const externalData = e.metadata.data?.data?.filter(d => d.type === 'external') ?? [];
        if (externalData.length === 0) continue;

        for (const dt of data.data) {
          const predicate = byUid(dt._uid);
          const existing = externalData.find(predicate);
          if (existing && !deepEquals<unknown>(existing, dt)) {
            e.updateMetadata(cb => {
              cb.data ??= {};
              cb.data!.data = cb.data?.data?.filter(dt => !predicate(dt));
            }, uow);
          }
        }
      }
      uow.commit();
    }
  };

  #dataProviderDeleteSchemaListener = (s: DataSchema) => {
    this.#schemas.removeSchema(s, UnitOfWork.immediate(this.#document.topLevelDiagrams[0]));
  };

  #dataProviderUpdateSchemaListener = (s: DataSchema) => {
    if (this.#schemas.has(s.id)) {
      this.#schemas.changeSchema(s);
    } else {
      this.#schemas.addSchema(s);
    }
  };

  constructor(document: DiagramDocument) {
    this.#document = document;
    this.#schemas = new DiagramDocumentDataSchemas(this.#document, [
      {
        id: 'default',
        name: 'Default',
        source: 'document',
        fields: [
          {
            id: 'name',
            name: 'Name',
            type: 'text'
          },
          {
            id: 'notes',
            name: 'Notes',
            type: 'longtext'
          }
        ]
      }
    ]);
    this.#templates = new DiagramDocumentDataTemplates(this.#document);
  }

  get dataProvider() {
    return this.#provider;
  }

  set dataProvider(dataProvider: DataProvider | undefined) {
    this.#provider?.off?.('addData', this.#dataProviderUpdateDataListener);
    this.#provider?.off?.('updateData', this.#dataProviderUpdateDataListener);
    this.#provider?.off?.('deleteData', this.#dataProviderDeleteDataListener);
    this.#provider?.off?.('addSchema', this.#dataProviderUpdateSchemaListener);
    this.#provider?.off?.('updateSchema', this.#dataProviderUpdateSchemaListener);
    this.#provider?.off?.('deleteSchema', this.#dataProviderDeleteSchemaListener);

    this.#provider = dataProvider;

    if (this.#provider) {
      this.#provider.on('addData', this.#dataProviderUpdateDataListener);
      this.#provider.on('updateData', this.#dataProviderUpdateDataListener);
      this.#provider.on('deleteData', this.#dataProviderDeleteDataListener);
      this.#provider.on('addSchema', this.#dataProviderUpdateSchemaListener);
      this.#provider.on('updateSchema', this.#dataProviderUpdateSchemaListener);
      this.#provider.on('deleteSchema', this.#dataProviderDeleteSchemaListener);
    }
  }

  get schemas() {
    return this.#schemas;
  }

  get templates() {
    return this.#templates;
  }
}
