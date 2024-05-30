import { Diagram } from '@diagram-craft/model/diagram';
import { useEffect, useState } from 'react';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  makePropertyArrayHook,
  PropertyArrayHook,
  PropertyArrayUndoableAction
} from './usePropertyFactory';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useEventListener } from '../hooks/useEventListener';

export const useTable = (diagram: Diagram) => {
  const [element, setElement] = useState<DiagramNode | undefined>(undefined);
  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selectionState.getSelectionType();
      if (
        selectionType !== 'single-node' &&
        selectionType !== 'single-label-node' &&
        selectionType !== 'single-edge' &&
        selectionType !== 'mixed'
      ) {
        setElement(undefined);
      } else {
        const el = diagram.selectionState.elements[0] as DiagramNode;
        if (el.nodeType === 'table') {
          setElement(el);
        } else if (el.parent?.nodeType === 'tableRow') {
          setElement(el.parent.parent);
        } else {
          setElement(undefined);
        }
      }
    };
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [diagram.selectionState]);
  return element;
};

export const useTableProperty: PropertyArrayHook<Diagram, NodeProps> = makePropertyArrayHook<
  Diagram,
  DiagramNode,
  NodeProps
>(
  (diagram => {
    const nodes = diagram.selectionState.nodes;
    if (nodes.length !== 1) return [];
    if (!isNode(nodes[0])) return [];

    const node = nodes[0] as DiagramNode;
    if (node.nodeType === 'table') return [node];
    if (node.parent?.nodeType === 'tableRow') return [node.parent.parent];
    return [];
  }) as (d: Diagram) => DiagramNode[],
  node => node.editProps,
  (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  {
    onAfterSet: (diagram, nodes, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramNode, NodeProps>(
          `Change node ${path}`,
          nodes,
          path,
          oldValue,
          newValue,
          () => new UnitOfWork(diagram),
          (node: DiagramNode, uow: UnitOfWork, cb) => node.updateProps(cb, uow)
        )
      );
    }
  }
);
