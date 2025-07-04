import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useMemo, useState } from 'react';
import { useApplication, useDiagram } from '../../../application';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from './ObjectPickerDrag';
import { createThumbnailDiagramForNode } from '@diagram-craft/model/diagramThumbnail';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

const NODE_CACHE = new Map<string, [Stencil, Diagram, DiagramNode, DiagramNode]>();

const makeDiagramNode = (mainDiagram: Diagram, n: Stencil) => {
  const cacheKey = n.id;

  if (NODE_CACHE.has(cacheKey)) {
    return NODE_CACHE.get(cacheKey)!;
  }

  const { node: stencilNode, diagram: stencilDiagram } = createThumbnailDiagramForNode(
    d => n.node(d),
    mainDiagram.document.definitions
  );
  stencilDiagram.viewBox.dimensions = {
    w: stencilNode.bounds.w + 10,
    h: stencilNode.bounds.h + 10
  };
  stencilDiagram.viewBox.offset = { x: -5, y: -5 };

  const { node: canvasNode, diagram: canvasDiagram } = createThumbnailDiagramForNode(
    d => n.canvasNode(d),
    mainDiagram.document.definitions
  );
  canvasDiagram.viewBox.dimensions = { w: canvasNode.bounds.w + 10, h: canvasNode.bounds.h + 10 };
  canvasDiagram.viewBox.offset = { x: -5, y: -5 };

  NODE_CACHE.set(cacheKey, [n, stencilDiagram, stencilNode, canvasNode]);

  return [n, stencilDiagram, stencilNode, canvasNode] as const;
};

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const [showHover, setShowHover] = useState(true);
  const app = useApplication();

  const stencils = props.stencils;
  const diagrams = useMemo(() => {
    return stencils.map(n => makeDiagramNode(diagram, n));
  }, [diagram, stencils]);

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map(([stencil, d, node, canvasNode], idx) => (
        <div key={d.id} style={{ background: 'transparent' }} data-width={d.viewBox.dimensions.w}>
          <PickerCanvas
            width={props.size}
            height={props.size}
            diagramWidth={d.viewBox.dimensions.w}
            diagramHeight={d.viewBox.dimensions.h}
            diagram={d}
            showHover={showHover}
            name={
              stencils[idx].name ??
              diagram.document.nodeDefinitions.get(node.nodeType).name ??
              'unknown'
            }
            onMouseDown={ev => {
              if (!isRegularLayer(diagram.activeLayer)) return;

              setShowHover(false);
              DRAG_DROP_MANAGER.initiate(
                new ObjectPickerDrag(ev, canvasNode, diagram, stencil.id, app),
                () => setShowHover(true)
              );
            }}
          />
        </div>
      ))}
    </div>
  );
};

type Props = {
  size: number;
  stencils: Stencil[];
};
