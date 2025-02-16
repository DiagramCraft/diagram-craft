import { DataTemplate } from './diagramDocument';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';

export class DiagramDocumentDataTemplates extends EventEmitter<{
  update: { template: DataTemplate };
  add: { template: DataTemplate };
  remove: { template: DataTemplate };
}> {
  #dataProviderTemplates: DataTemplate[] = [];

  constructor(templates?: DataTemplate[]) {
    super();
    this.#dataProviderTemplates = templates ?? [];
  }

  add(template: DataTemplate) {
    this.#dataProviderTemplates.push(template);
    this.emit('add', { template });
  }

  remove(template: DataTemplate | string) {
    const tpl = this.#dataProviderTemplates.find(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    const idx = this.#dataProviderTemplates.findIndex(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    if (idx !== -1) {
      this.#dataProviderTemplates.splice(idx, 1);

      assert.present(tpl);
      this.emit('remove', { template: tpl });
    }
  }

  update(_template: DataTemplate) {
    this.emit('update', { template: _template });
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

  replaceBy(templates: DataTemplate[]) {
    this.#dataProviderTemplates = templates ?? [];
    // TODO: Should we emit events here?
  }
}
