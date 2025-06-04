/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { DataTemplate } from '../../diagramDocument';
import { DiagramDocumentDataTemplates } from '../../diagramDocumentDataTemplates';

const templates: DataTemplate[] = [
  { id: '1', schemaId: 'schema1', name: 'Template 1', template: {} as any },
  { id: '2', schemaId: 'schema2', name: 'Template 2', template: {} as any }
];

describe('DiagramDocumentDataTemplates', () => {
  setupYJS();

  it('should initialize with given templates', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    expect(instance1.all()).toEqual(templates);
    expect(instance2.all()).toEqual(templates);
  });

  it('should allow adding a new template', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    const newTemplate: DataTemplate = {
      id: '3',
      schemaId: 'schema3',
      name: 'Template 3',
      template: {} as any
    };

    const addListener1 = vi.fn();
    instance1.on('add', addListener1);

    const addListener2 = vi.fn();
    instance2.on('add', addListener2);

    instance1.add(newTemplate);
    expect(instance1.all().at(-1)).toEqual(newTemplate);
    expect(instance2.all().at(-1)).toEqual(newTemplate);
    expect(addListener1).toHaveBeenCalledWith({ template: newTemplate });
    expect(addListener2).toHaveBeenCalledWith({ template: newTemplate });
  });

  it('should allow removing a template by object', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    const removeListener1 = vi.fn();
    instance1.on('remove', removeListener1);

    const removeListener2 = vi.fn();
    instance2.on('remove', removeListener2);

    const templateToRemove = templates[0];
    instance1.remove(templateToRemove);

    expect(instance1.all()).toEqual([templates[1]]);
    expect(instance2.all()).toEqual([templates[1]]);
    expect(removeListener1).toHaveBeenCalledWith({ template: templateToRemove });
    expect(removeListener2).toHaveBeenCalledWith({ template: templateToRemove });
  });

  it('should allow removing a template by id', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    const removeListener1 = vi.fn();
    instance1.on('remove', removeListener1);

    const removeListener2 = vi.fn();
    instance2.on('remove', removeListener2);

    instance1.remove('2');

    expect(instance1.all()).toEqual([templates[0]]);
    expect(instance2.all()).toEqual([templates[0]]);
    expect(removeListener1).toHaveBeenCalledWith({ template: templates[1] });
    expect(removeListener2).toHaveBeenCalledWith({ template: templates[1] });
  });

  it('should allow updating an existing template', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    const updatedTemplate = { ...templates[0], name: 'Updated Template 1' };

    const updateListener1 = vi.fn();
    instance1.on('update', updateListener1);

    const updateListener2 = vi.fn();
    instance2.on('update', updateListener2);

    instance1.update(updatedTemplate);

    expect(instance1.all()).toEqual([updatedTemplate, templates[1]]);
    expect(instance2.all()).toEqual([updatedTemplate, templates[1]]);
    expect(updateListener1).toHaveBeenCalledWith({ template: updatedTemplate });
    expect(updateListener2).toHaveBeenCalledWith({ template: updatedTemplate });
  });

  it('should replace all templates', () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const instance1 = new DiagramDocumentDataTemplates(doc1, templates);
    const instance2 = new DiagramDocumentDataTemplates(doc2, templates);

    const newTemplates = [
      { id: '3', schemaId: 'schema3', name: 'Template 3', template: {} },
      { id: '4', schemaId: 'schema4', name: 'Template 4', template: {} }
    ] as DataTemplate[];

    instance1.replaceBy(newTemplates);

    expect(instance1.all()).toEqual(newTemplates);
    expect(instance2.all()).toEqual(newTemplates);
  });
});
