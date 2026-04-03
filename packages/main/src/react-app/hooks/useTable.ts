import { Diagram } from '@diagram-craft/model/diagram';
import { useEffect, useState } from 'react';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { makePropertyArrayHook } from './usePropertyFactory';
import { useEventListener } from './useEventListener';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { TableHelper } from '@diagram-craft/canvas/node-types/Table.nodeType';

export const useTable = (diagram: Diagram) => {
  const [element, setElement] = useState<DiagramNode | undefined>(undefined);
  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selection.type;
      if (
        selectionType !== 'single-node' &&
        selectionType !== 'single-label-node' &&
        selectionType !== 'single-edge' &&
        selectionType !== 'mixed'
      ) {
        setElement(undefined);
      } else {
        const el = diagram.selection.elements[0] as DiagramNode;
        const table = new TableHelper(el).isTable() ? new TableHelper(el).tableNode : undefined;
        setElement(table);
      }
    };
    callback();

    diagram.selection.on('change', callback);
    return () => {
      diagram.selection.off('change', callback);
    };
  }, [diagram.selection]);
  return element;
};

export const useTableProperty = makePropertyArrayHook<DiagramNode, NodeProps>(
  path => `Change node ${path}`,
  (diagram => {
    const nodes = diagram.selection.nodes;
    if (nodes.length !== 1) return [];
    if (!isNode(nodes[0])) return [];

    const helper = new TableHelper(nodes[0]);
    return helper.isTable() ? [helper.tableNode] : [];
  }) as (d: Diagram) => DiagramNode[],
  node => node.editProps,
  node => node.storedProps,
  (node, path) => node.getPropsInfo(path),
  (element, uow, cb) => element.updateProps(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  nodeDefaults
);
