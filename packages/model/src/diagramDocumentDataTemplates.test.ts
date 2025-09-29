import { describe, expect, it, vi } from 'vitest';
import { DiagramDocumentDataTemplates } from './diagramDocumentDataTemplates';
import { DataTemplate } from './diagramDocument';
import { CRDT } from './collaboration/crdt';
import { Backends } from './collaboration/collaborationTestUtils';

const templates: DataTemplate[] = [
  { id: '1', schemaId: 'schema1', name: 'Template 1', template: {} as any },
  { id: '2', schemaId: 'schema2', name: 'Template 2', template: {} as any }
];

describe.each(Backends.all())('DiagramDocumentDataTemplates [%s]', (_name, backend) => {
  describe('constructor', () => {
    it('should initialize with given templates', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      // Verify
      expect(instance1.all).toEqual(templates);
      if (instance2) expect(instance2.all).toEqual(templates);
    });
  });

  describe('add', () => {
    it('should allow adding a new template', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      const addListener1 = vi.fn();
      instance1.on('add', addListener1);

      const addListener2 = vi.fn();
      instance2?.on('add', addListener2);

      // Act
      const newTemplate: DataTemplate = {
        id: '3',
        schemaId: 'schema3',
        name: 'Template 3',
        template: {} as any
      };

      instance1.add(newTemplate);

      // Verify
      expect(instance1.all.at(-1)).toEqual(newTemplate);
      expect(addListener1).toHaveBeenCalledWith({ template: newTemplate });
      if (instance2) {
        expect(instance2.all.at(-1)).toEqual(newTemplate);
        expect(addListener2).toHaveBeenCalledWith({ template: newTemplate });
      }
    });
  });

  describe('remove', () => {
    it('should allow removing a template by object', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      const removeListener1 = vi.fn();
      instance1.on('remove', removeListener1);

      const removeListener2 = vi.fn();
      instance2?.on('remove', removeListener2);

      // Act
      const templateToRemove = templates[0]!;
      instance1.remove(templateToRemove);

      // Verify
      expect(instance1.all).toEqual([templates[1]]);
      expect(removeListener1).toHaveBeenCalledWith({ template: templateToRemove });
      if (instance2) {
        expect(instance2.all).toEqual([templates[1]]);
        expect(removeListener2).toHaveBeenCalledWith({ template: templateToRemove });
      }
    });

    it('should allow removing a template by id', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      const removeListener1 = vi.fn();
      instance1.on('remove', removeListener1);

      const removeListener2 = vi.fn();
      instance2?.on('remove', removeListener2);

      // Act
      instance1.remove('2');

      // Verify
      expect(instance1.all).toEqual([templates[0]]);
      expect(removeListener1).toHaveBeenCalledWith({ template: templates[1] });
      if (instance2) {
        expect(instance2.all).toEqual([templates[0]]);
        expect(removeListener2).toHaveBeenCalledWith({ template: templates[1] });
      }
    });
  });

  describe('update', () => {
    it('should allow updating an existing template', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      const updateListener1 = vi.fn();
      instance1.on('update', updateListener1);

      const updateListener2 = vi.fn();
      instance2?.on('update', updateListener2);

      // Act
      const updatedTemplate = { ...templates[0]!, name: 'Updated Template 1' };
      instance1.update(updatedTemplate);

      // Verify
      expect(instance1.all).toEqual([updatedTemplate, templates[1]]);
      expect(updateListener1).toHaveBeenCalledWith({ template: updatedTemplate });
      if (instance2) {
        expect(instance2.all).toEqual([updatedTemplate, templates[1]]);
        expect(updateListener2).toHaveBeenCalledWith({ template: updatedTemplate });
      }
    });
  });

  describe('byId', () => {
    it('should retrieve a template by ID', () => {
      const instance = new DiagramDocumentDataTemplates(CRDT.makeRoot(), templates);
      const template = instance.byId('1');

      expect(template).toEqual(templates[0]);
    });
  });

  describe('bySchema', () => {
    it('should retrieve templates by schema ID', () => {
      const instance = new DiagramDocumentDataTemplates(CRDT.makeRoot(), templates);
      const res = instance.bySchema('schema1');

      expect(res).toEqual([templates[0]]);
    });
  });

  describe('replaceBy', () => {
    it('should replace all templates', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const instance1 = new DiagramDocumentDataTemplates(root1, templates);
      const instance2 = root2 ? new DiagramDocumentDataTemplates(root2, templates) : undefined;

      // Act
      const newTemplates = [
        { id: '3', schemaId: 'schema3', name: 'Template 3', template: {} },
        { id: '4', schemaId: 'schema4', name: 'Template 4', template: {} }
      ] as DataTemplate[];
      instance1.replaceBy(newTemplates);

      // Verify
      expect(instance1.all).toEqual(newTemplates);
      if (instance2) expect(instance2.all).toEqual(newTemplates);
    });
  });
});
