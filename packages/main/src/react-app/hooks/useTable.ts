import { Diagram } from '@diagram-craft/model/diagram';
import { useEffect, useState } from 'react';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { makePropertyArrayHook } from './usePropertyFactory';
import { useEventListener } from './useEventListener';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { assert } from '@diagram-craft/utils/assert';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

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
        if (el.nodeType === 'table') {
          setElement(el);
        } else if (el.parent && isNode(el.parent) && el.parent.nodeType === 'tableRow') {
          assert.node(el.parent.parent!);
          setElement(el.parent.parent);
        } else {
          setElement(undefined);
        }
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

    const node = nodes[0];
    if (node.nodeType === 'table') return [node];
    if (isNode(node.parent) && node.parent?.nodeType === 'tableRow') return [node.parent.parent];
    return [];
  }) as (d: Diagram) => DiagramNode[],
  node => node.editProps,
  node => node.storedProps,
  (node, path) => node.getPropsInfo(path),
  (element, uow, cb) => element.updateProps(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  nodeDefaults
);
