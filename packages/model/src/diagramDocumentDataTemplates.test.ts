/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi } from 'vitest';
import { DiagramDocumentDataTemplates } from './diagramDocumentDataTemplates';
import { DataTemplate } from './diagramDocument';
import { CRDT } from './collaboration/crdt';

const templates: DataTemplate[] = [
  { id: '1', schemaId: 'schema1', name: 'Template 1', template: {} as any },
  { id: '2', schemaId: 'schema2', name: 'Template 2', template: {} as any }
];

describe('DiagramDocumentDataTemplates', () => {
  it('should initialize with given templates', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);
    expect(instance.all()).toEqual(templates);
  });

  it('should allow adding a new template', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);
    const newTemplate: DataTemplate = {
      id: '3',
      schemaId: 'schema3',
      name: 'Template 3',
      template: {} as any
    };

    const addListener = vi.fn();
    instance.on('add', addListener);

    instance.add(newTemplate);
    expect(instance.all().at(-1)).toEqual(newTemplate);
    expect(addListener).toHaveBeenCalledWith({ template: newTemplate });
  });

  it('should allow removing a template by object', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);

    const removeListener = vi.fn();
    instance.on('remove', removeListener);

    const templateToRemove = templates[0];
    instance.remove(templateToRemove);

    expect(instance.all()).toEqual([templates[1]]);
    expect(removeListener).toHaveBeenCalledWith({ template: templateToRemove });
  });

  it('should allow removing a template by id', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);

    const removeListener = vi.fn();
    instance.on('remove', removeListener);

    instance.remove('2');

    expect(instance.all()).toEqual([templates[0]]);
    expect(removeListener).toHaveBeenCalledWith({ template: templates[1] });
  });

  it('should allow updating an existing template', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);
    const updatedTemplate = { ...templates[0], name: 'Updated Template 1' };

    const updateListener = vi.fn();
    instance.on('update', updateListener);

    instance.update(updatedTemplate);

    expect(instance.all()).toEqual([updatedTemplate, templates[1]]);
    expect(updateListener).toHaveBeenCalledWith({ template: updatedTemplate });
  });

  it('should retrieve a template by ID', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);
    const template = instance.byId('1');

    expect(template).toEqual(templates[0]);
  });

  it('should retrieve templates by schema ID', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);
    const res = instance.bySchema('schema1');

    expect(res).toEqual([templates[0]]);
  });

  it('should replace all templates', () => {
    const instance = new DiagramDocumentDataTemplates(new CRDT.Map(), templates);

    const newTemplates = [
      { id: '3', schemaId: 'schema3', name: 'Template 3', template: {} },
      { id: '4', schemaId: 'schema4', name: 'Template 4', template: {} }
    ] as DataTemplate[];

    instance.replaceBy(newTemplates);

    expect(instance.all()).toEqual(newTemplates);
  });
});
