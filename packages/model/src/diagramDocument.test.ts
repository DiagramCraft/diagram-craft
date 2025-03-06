import { describe, expect, it } from 'vitest';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';

/* eslint-disable @typescript-eslint/no-explicit-any */

const nodeDefinitions = {} as any; // Replace with a proper mock or setup
const edgeDefinitions = {} as any; // Replace with a proper mock or setup

describe('DiagramDocument', () => {
  describe('getById', () => {
    it('should return the diagram with the specified ID', () => {
      const document = new DiagramDocument(nodeDefinitions, edgeDefinitions);

      const diagram1 = { id: 'diagram1' } as Diagram;
      const diagram2 = { id: 'diagram2' } as Diagram;
      document.addDiagram(diagram1);
      document.addDiagram(diagram2);

      const result = document.getById('diagram1');
      expect(result).toBe(diagram1);
    });

    it('should return the diagram with the specified ID for nested diagrams', () => {
      const document = new DiagramDocument(nodeDefinitions, edgeDefinitions);

      const diagram2 = { id: 'diagram2' } as Diagram;
      const diagram1 = { id: 'diagram1', diagrams: [diagram2] } as any as Diagram;
      document.addDiagram(diagram1);

      const result = document.getById('diagram2');
      expect(result).toBe(diagram2);
    });

    it('should return undefined if no diagram with the specified ID is found', () => {
      const document = new DiagramDocument(nodeDefinitions, edgeDefinitions);

      const diagram = { id: 'diagram1' } as Diagram;
      document.addDiagram(diagram);

      const result = document.getById('nonExistentId');
      expect(result).toBeUndefined();
    });

    it('should return undefined when no diagrams are present', () => {
      const document = new DiagramDocument(nodeDefinitions, edgeDefinitions);

      const result = document.getById('anyId');
      expect(result).toBeUndefined();
    });
  });
});
