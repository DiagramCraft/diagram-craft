import { beforeEach, describe, expect, test } from 'vitest';
import { ExternalDataLinkUpdateTemplate } from './externalDataActions';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import type { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';
import { newid } from '@diagram-craft/utils/id';

describe('ExternalDataLinkUpdateTemplate', () => {
  let action: ExternalDataLinkUpdateTemplate;

  beforeEach(() => {
    const mockContext = {
      model: {
        on: () => {},
        off: () => {}
      }
    };
    action = new ExternalDataLinkUpdateTemplate(mockContext as any);
  });

  describe('removeOldTemplateProps', () => {
    test('should remove props that match old template values', () => {
      const elementProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        },
        stroke: {
          color: '#000000',
          width: 2
        }
      };

      const oldTemplateProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        }
      };

      (action as any).removeOldTemplateProps(elementProps, oldTemplateProps);

      expect(elementProps.fill).toBeUndefined();
      expect(elementProps.stroke).toBeDefined();
      expect(elementProps.stroke?.color).toBe('#000000');
    });

    test('should not remove props that have been customized', () => {
      const elementProps: NodeProps = {
        fill: {
          color: '#00ff00',
          enabled: true
        },
        stroke: {
          color: '#000000',
          width: 2
        }
      };

      const oldTemplateProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        }
      };

      (action as any).removeOldTemplateProps(elementProps, oldTemplateProps);

      expect(elementProps.fill).toBeDefined();
      expect(elementProps.fill?.color).toBe('#00ff00');
    });

    test('should handle nested props correctly', () => {
      const elementProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true,
          type: 'solid'
        },
        stroke: {
          color: '#000000'
        }
      };

      const oldTemplateProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        }
      };

      (action as any).removeOldTemplateProps(elementProps, oldTemplateProps);

      expect(elementProps.fill).toBeDefined();
      expect(elementProps.fill?.type).toBe('solid');
      expect(elementProps.fill?.color).toBeUndefined();
      expect(elementProps.fill?.enabled).toBeUndefined();
    });
  });

  describe('addNewTemplateProps', () => {
    test('should add props that are missing from element', () => {
      const elementProps: NodeProps = {
        stroke: {
          color: '#000000'
        }
      };

      const newTemplateProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        }
      };

      (action as any).addNewTemplateProps(elementProps, newTemplateProps);

      expect(elementProps.fill).toBeDefined();
      expect(elementProps.fill?.color).toBe('#ff0000');
      expect(elementProps.fill?.enabled).toBe(true);
      expect(elementProps.stroke?.color).toBe('#000000');
    });

    test('should not overwrite existing props', () => {
      const elementProps: NodeProps = {
        fill: {
          color: '#00ff00'
        }
      };

      const newTemplateProps: NodeProps = {
        fill: {
          color: '#ff0000',
          enabled: true
        }
      };

      (action as any).addNewTemplateProps(elementProps, newTemplateProps);

      expect(elementProps.fill?.color).toBe('#00ff00');
      expect(elementProps.fill?.enabled).toBe(true);
    });

    test('should handle nested props correctly', () => {
      const elementProps: NodeProps = {
        text: {
          fontSize: 16
        }
      };

      const newTemplateProps: NodeProps = {
        text: {
          fontSize: 12,
          color: '#000000',
          bold: true
        }
      };

      (action as any).addNewTemplateProps(elementProps, newTemplateProps);

      expect(elementProps.text?.fontSize).toBe(16);
      expect(elementProps.text?.color).toBe('#000000');
      expect(elementProps.text?.bold).toBe(true);
    });
  });

  describe('updateElementsUsingTemplate', () => {
    test('should update all elements with matching templateId', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode();
      const node2 = layer.addNode();

      const templateId = newid();

      UnitOfWork.execute(diagram, uow => {
        node1.updateMetadata(m => (m.data = { templateId }), uow);
        node2.updateMetadata(m => (m.data = { templateId }), uow);
        node1.updateProps(p => (p.text = { color: '#ff0000', fontSize: 12 }), uow);
        node2.updateProps(p => (p.text = { color: '#ff0000', fontSize: 12 }), uow);
      });

      const oldTemplate = {
        ...serializeDiagramElement(node1),
        props: { text: { color: '#ff0000', fontSize: 12 } }
      } as any as SerializedElement;

      const newTemplate = {
        ...serializeDiagramElement(node1),
        props: { text: { color: '#00ff00', fontSize: 14, bold: true } }
      } as any as SerializedElement;

      (action as any).updateElementsUsingTemplate(
        diagram.document,
        templateId,
        oldTemplate,
        newTemplate
      );

      expect(node1.renderProps.text?.color).toBe('#00ff00');
      expect(node1.renderProps.text?.fontSize).toBe(14);
      expect(node1.renderProps.text?.bold).toBe(true);
      expect(node2.renderProps.text?.color).toBe('#00ff00');
      expect(node2.renderProps.text?.fontSize).toBe(14);
      expect(node2.renderProps.text?.bold).toBe(true);
    });

    test('should add new template props and keep non-template props', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode();
      const templateId = newid();

      UnitOfWork.execute(diagram, uow => {
        node1.updateMetadata(m => (m.data = { templateId }), uow);
        node1.updateProps(p => (p.text = { fontSize: 12, italic: true }), uow);
      });

      const oldTemplate = {
        ...serializeDiagramElement(node1),
        props: { text: { fontSize: 12 } }
      } as any as SerializedElement;

      const newTemplate = {
        ...serializeDiagramElement(node1),
        props: { text: { fontSize: 14, bold: true, color: '#ff0000' } }
      } as any as SerializedElement;

      (action as any).updateElementsUsingTemplate(
        diagram.document,
        templateId,
        oldTemplate,
        newTemplate
      );

      expect(node1.renderProps.text?.fontSize).toBe(14);
      expect(node1.renderProps.text?.bold).toBe(true);
      expect(node1.renderProps.text?.color).toBe('#ff0000');
    });
  });
});
