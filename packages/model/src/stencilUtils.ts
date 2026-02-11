import { EdgeProps, ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';
import { NodeTexts } from '@diagram-craft/model/diagramNode';
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
        const n = ElementFactory.node(
          newid(),
          typeId,
          Box.applyAspectRatio(
            { x: 0, y: 0, w: diagram.bounds.w, h: diagram.bounds.h, r: 0 },
            opts?.aspectRatio ?? 1
          ),
          layer,
          (opts?.props?.(t) ?? {}) as NodeProps,
          opts?.metadata ?? {},
          opts?.texts
        );

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
        const e = ElementFactory.edge(
          newid(),
          new FreeEndpoint(_p(0, 50)),
          new FreeEndpoint(_p(100, 50)),
          { ...(opts?.props?.(t) ?? {}), shape: typeId } as EdgeProps,
          opts?.metadata ?? {},
          [],
          layer
        );

        layer.addElement(e, uow);

        return { bounds: Box.from({ w: 100, h: 100 }), elements: [e], diagram, layer };
      });
    }
};
