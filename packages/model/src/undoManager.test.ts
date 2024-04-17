import { describe, expect, test } from 'vitest';
import { UndoManager } from './undoManager';
import { TestNodeDefinition } from './TestNodeDefinition';
import { NodeDefinitionRegistry } from './elementDefinitionRegistry';
import { Diagram } from './diagram';
import { DiagramDocument } from './diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';

const doc = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());

describe('UndoManager', () => {
  test('add()', () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const d = new Diagram('id', 'name', doc);
    const manager = new UndoManager(d);
    let x = 0;

    manager.add({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    expect(x).toBe(0);
    expect(manager.undoableActions.length).toBe(1);
  });

  test('addAndExecute()', () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const d = new Diagram('id', 'name', doc);
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    expect(x).toBe(1);
  });

  test('undo()', () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const d = new Diagram('id', 'name', doc);
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    manager.undo();

    expect(x).toBe(0);
  });

  test('redo()', () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const d = new Diagram('id', 'name', doc);
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    manager.undo();
    manager.redo();

    expect(x).toBe(1);
  });
});
