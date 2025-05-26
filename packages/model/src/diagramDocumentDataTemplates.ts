import { DataTemplate } from './diagramDocument';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import { CRDT, CRDTMap } from './collaboration/crdt';

export class DiagramDocumentDataTemplates extends EventEmitter<{
  update: { template: DataTemplate };
  add: { template: DataTemplate };
  remove: { template: DataTemplate };
}> {
  readonly #templates: CRDTMap<DataTemplate>;

  constructor(root: CRDTMap, templates?: DataTemplate[]) {
    super();
    this.#templates = CRDT.getMap(root, 'templates');

    this.#templates.on('remoteInsert', p => this.emit('add', { template: p.value }));
    this.#templates.on('remoteUpdate', p => this.emit('update', { template: p.value }));
    this.#templates.on('remoteDelete', p => this.emit('remove', { template: p.value }));

    if (templates) this.replaceBy(templates);
  }

  add(template: DataTemplate) {
    this.#templates.set(template.id, template);
    this.emit('add', { template });
  }

  remove(template: DataTemplate | string) {
    const tpl = this.byId(typeof template === 'string' ? template : template.id);
    assert.present(tpl);

    this.#templates.delete(typeof template === 'string' ? template : template.id);
    this.emit('remove', { template: tpl });
  }

  update(template: DataTemplate) {
    this.#templates.set(template.id, template);
    this.emit('update', { template: template });
  }

  all() {
    return Array.from(this.#templates.values());
  }

  byId(id: string) {
    return this.#templates.get(id);
  }

  bySchema(schema: string) {
    return this.all().filter(t => t.schemaId === schema);
  }

  replaceBy(templates: DataTemplate[]) {
    this.#templates.clear();
    for (const template of templates) {
      this.#templates.set(template.id, template);
    }
    // TODO: Should we emit events here?
  }
}
