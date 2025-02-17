import { DataTemplate } from './diagramDocument';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';

export class DiagramDocumentDataTemplates extends EventEmitter<{
  update: { template: DataTemplate };
  add: { template: DataTemplate };
  remove: { template: DataTemplate };
}> {
  #templates: DataTemplate[] = [];

  constructor(templates?: DataTemplate[]) {
    super();
    this.#templates = templates ?? [];
  }

  add(template: DataTemplate) {
    this.#templates.push(template);
    this.emit('add', { template });
  }

  remove(template: DataTemplate | string) {
    const tpl = this.#templates.find(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    const idx = this.#templates.findIndex(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    if (idx !== -1) {
      this.#templates.splice(idx, 1);

      assert.present(tpl);
      this.emit('remove', { template: tpl });
    }
  }

  update(template: DataTemplate) {
    this.#templates = this.#templates.map(tpl => {
      if (tpl.id === template.id) {
        return template;
      } else {
        return tpl;
      }
    });
    this.emit('update', { template: template });
  }

  all() {
    return this.#templates;
  }

  byId(id: string) {
    return this.#templates.find(t => t.id === id);
  }

  bySchema(schema: string) {
    return this.#templates.filter(t => t.schemaId === schema);
  }

  replaceBy(templates: DataTemplate[]) {
    this.#templates = templates ?? [];
    // TODO: Should we emit events here?
  }
}
