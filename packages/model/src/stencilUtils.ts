import { EdgeProps, ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';
import { type DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { _p } from '@diagram-craft/geometry/point';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram, DiagramCRDT } from '@diagram-craft/model/diagram';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { assignNewBounds, cloneElements } from './diagramElementUtils';
import { isNode } from './diagramElement';
import type { Stencil, StencilElements } from './stencilRegistry';
import { Stylesheet } from './diagramStyles';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import { deepClone, getTypedKeys } from '@diagram-craft/utils/object';

const DEFAULT_TEXT_NODE_CONTENT = 'Text';

type MakeStencilNodeOptsProps = (t: 'picker' | 'canvas') => Partial<NodeProps | EdgeProps>;

export type MakeStencilNodeOpts = {
  id?: string;
  name?: string;
  aspectRatio?: number;
  size?: { w: number; h: number };
  props?: MakeStencilNodeOptsProps;
  metadata?: ElementMetadata;
  texts?: NodeTexts;
  subPackage?: string;
};

export const addStencilStylesToDocument = (
  stencil: Stencil,
  document: DiagramDocument,
  uow: UnitOfWork
) => {
  const styleManager = document.styles;
  for (const style of stencil.styles ?? []) {
    if (styleManager.get(style.id) === undefined) {
      const stylesheet = Stylesheet.fromSnapshot(
        style.type,
        style,
        styleManager.crdt.factory,
        styleManager
      );
      styleManager.addStylesheet(style.id, stylesheet, uow);
    }
  }
};

export const applyStencilToNode = (
  diagram: Diagram,
  node: DiagramNode,
  layer: RegularLayer,
  stencil: Stencil,
  uow: UnitOfWork
) => {
  const stencilElements = stencil.forCanvas(diagram.document.registry);
  assert.true(stencilElements.elements.length > 0);

  addStencilStylesToDocument(stencil, diagram.document, uow);

  if (stencilElements.elements.length === 1) {
    changeNodeToSingleElementStencil(node, layer, stencilElements, uow);
  } else {
    changeNodeToGroupStencil(node, layer, stencilElements, uow);
  }

  const definition = node.getDefinition();
  if (definition.setNodeLinkOptions !== undefined) {
    definition.setNodeLinkOptions(node, stencil.nodeLinkOptions, uow);
  }

  if (node.nodeType === 'text' && node.getText().trim() === '') {
    node.setText(DEFAULT_TEXT_NODE_CONTENT, uow);
  }

  // Rendering logic assumes node types stay stable, so changing it needs a forced redraw.
  uow.on('after', 'commit', 'forceRedraw', () => {
    diagram.emit('diagramChange');
  });
  uow.on('after', 'undo', 'forceRedraw', () => {
    diagram.emit('diagramChange');
  });
  uow.on('after', 'redo', 'forceRedraw', () => {
    diagram.emit('diagramChange');
  });
};

const changeNodeToSingleElementStencil = (
  node: DiagramNode,
  layer: RegularLayer,
  stencilElements: StencilElements,
  uow: UnitOfWork
) => {
  const source = stencilElements.elements[0]!;
  if (!isNode(source)) throw new VerifyNotReached();

  node.changeNodeType(source.nodeType, uow);

  node.updateProps(props => {
    for (const k of getTypedKeys(props)) {
      delete props[k];
    }
    const storedProps = deepClone(source.storedProps);
    for (const k of getTypedKeys(storedProps)) {
      // @ts-expect-error same key space, narrowed dynamically
      props[k] = storedProps[k];
    }
  }, uow);

  const children = cloneElements(source.children, layer);
  node.setChildren(children, uow);
};

const changeNodeToGroupStencil = (
  node: DiagramNode,
  layer: RegularLayer,
  stencilElements: StencilElements,
  uow: UnitOfWork
) => {
  const targetBounds = node.bounds;

  node.changeNodeType('group', uow);
  node.updateProps(props => {
    for (const k of getTypedKeys(props)) {
      delete props[k];
    }
  }, uow);

  const children = cloneElements(stencilElements.elements, layer);
  node.setChildren(children, uow);

  const sourceBounds = Box.boundingBox(children.map(e => e.bounds));
  assignNewBounds(
    children,
    { x: targetBounds.x, y: targetBounds.y },
    {
      x: targetBounds.w / (sourceBounds.w === 0 ? 1 : sourceBounds.w),
      y: targetBounds.h / (sourceBounds.h === 0 ? 1 : sourceBounds.h)
    },
    uow
  );
};

export const StencilUtils = {
  makeDiagram: (defs: Registry) => {
    const id = newid();
    const doc = new DiagramDocument(defs, true, new NoOpCRDTRoot());
    const d = new Diagram(id, id, doc, new NoOpCRDTMap<DiagramCRDT>());

    const layer = new RegularLayer(newid(), newid(), [], d);
    UnitOfWork.executeSilently(d, uow => d.layers.add(layer, uow));

    return { diagram: d, layer };
  },

  makeNode:
    (typeId: string, t: 'picker' | 'canvas', opts?: MakeStencilNodeOpts) =>
    (registry: Registry) => {
      const { diagram, layer } = StencilUtils.makeDiagram(registry);
      return UnitOfWork.execute(diagram, uow => {
        const n = ElementFactory.node({
          ...opts,
          nodeType: typeId,
          bounds: Box.applyAspectRatio(
            { x: 0, y: 0, w: diagram.bounds.w, h: diagram.bounds.h, r: 0 },
            opts?.aspectRatio ?? 1
          ),
          layer,
          props: (opts?.props?.(t) ?? {}) as NodeProps
        });

        const size = { w: 100, h: 100 };

        n.setBounds(
          Box.applyAspectRatio(
            { x: 0, y: 0, w: opts?.size?.w ?? size.w, h: opts?.size?.h ?? size.h, r: 0 },
            opts?.aspectRatio ?? 1
          ),
          uow
        );

        layer.addElement(n, uow);

        return { bounds: n.bounds, elements: [n], diagram, layer };
      });
    },

  makeEdge:
    (typeId: string, t: 'picker' | 'canvas', opts?: MakeStencilNodeOpts) =>
    (registry: Registry) => {
      const { diagram, layer } = StencilUtils.makeDiagram(registry);
      return UnitOfWork.execute(diagram, uow => {
        const e = ElementFactory.edge({
          start: new FreeEndpoint(_p(0, 50)),
          end: new FreeEndpoint(_p(100, 50)),
          props: { ...(opts?.props?.(t) ?? {}), shape: typeId } as EdgeProps,
          metadata: opts?.metadata ?? {},
          layer
        });

        layer.addElement(e, uow);

        return { bounds: Box.from({ w: 100, h: 100 }), elements: [e], diagram, layer };
      });
    }
};
