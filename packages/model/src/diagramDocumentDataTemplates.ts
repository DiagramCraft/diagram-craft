import { DataTemplate, DiagramDocument } from './diagramDocument';

export class DiagramDocumentDataTemplates {
  #dataProviderTemplates: DataTemplate[] = [];
  #diagramDocument: DiagramDocument;

  constructor(diagramDocument: DiagramDocument, templates?: DataTemplate[]) {
    this.#diagramDocument = diagramDocument;
    this.#dataProviderTemplates = templates ?? [];
  }

  add(template: DataTemplate) {
    this.#dataProviderTemplates.push(template);
    this.notify();
  }

  remove(template: DataTemplate | string) {
    const idx = this.#dataProviderTemplates.findIndex(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    if (idx !== -1) {
      this.#dataProviderTemplates.splice(idx, 1);
    }
    this.notify();
  }

  update(_template: DataTemplate) {
    this.notify();
  }

  all() {
    return this.#dataProviderTemplates;
  }

  byId(id: string) {
    return this.#dataProviderTemplates.find(t => t.id === id);
  }

  bySchema(schema: string) {
    return this.#dataProviderTemplates.filter(t => t.schemaId === schema);
  }

  private notify() {
    for (const d of this.#diagramDocument.diagramIterator({ nest: true })) {
      d.emit('change');
    }
  }
}
