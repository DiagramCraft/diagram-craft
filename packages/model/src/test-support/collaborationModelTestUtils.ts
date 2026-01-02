import { vi } from 'vitest';
import { type TestDiagramBuilder, TestLayerBuilder, TestModel } from './testModel';
import type { DiagramDocument } from '../diagramDocument';
import type { Diagram } from '../diagram';
import type { RegularLayer } from '../diagramLayerRegular';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { Backend } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

export const resetListeners = (listeners: Array<ReturnType<typeof vi.fn>>) => {
  listeners.forEach(l => l.mockReset());
};

export type StandardTestModel = {
  root1: CRDTRoot;
  root2: CRDTRoot | undefined;
  diagram1: TestDiagramBuilder;
  doc1: DiagramDocument;
  layer1: TestLayerBuilder;
  diagram2: Diagram | undefined;
  doc2: DiagramDocument | undefined;
  layer2: RegularLayer | undefined;
  elementChange: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>];
  elementAdd: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>];
  elementRemove: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>];
  reset: () => void;
};

export const standardTestModel = (backend: Backend): StandardTestModel => {
  const [root1, root2] = backend.syncedDocs();

  const diagram1 = TestModel.newDiagram(root1);
  const doc1 = diagram1.document;
  const layer1 = diagram1.newLayer();

  const doc2 = root2 ? TestModel.newDocument(root2) : undefined;
  const diagram2 = root2 ? doc2!.diagrams[0]! : undefined;
  const layer2 = root2 ? (diagram2!.layers.all[0] as RegularLayer) : undefined;

  const elementChange: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>] = [vi.fn(), vi.fn()];
  diagram1.on('elementChange', elementChange[0]);
  if (diagram2) diagram2.on('elementChange', elementChange[1]);

  const elementAdd: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>] = [vi.fn(), vi.fn()];
  diagram1.on('elementAdd', elementAdd[0]);
  if (diagram2) diagram2.on('elementAdd', elementAdd[1]);

  const elementRemove: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>] = [vi.fn(), vi.fn()];
  diagram1.on('elementRemove', elementRemove[0]);
  if (diagram2) diagram2.on('elementRemove', elementRemove[1]);

  return {
    root1,
    root2,
    diagram1,
    doc1,
    layer1,
    diagram2,
    doc2,
    layer2,
    elementChange,
    elementAdd,
    elementRemove,
    reset: () => {
      resetListeners(elementRemove);
      resetListeners(elementChange);
      resetListeners(elementAdd);
    }
  };
};
