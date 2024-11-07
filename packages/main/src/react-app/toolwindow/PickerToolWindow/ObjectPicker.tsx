import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { isRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';
import { Stencil, StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useMemo, useState } from 'react';
import { useApplication, useDiagram } from '../../../application';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from './ObjectPickerDrag';

const NODE_CACHE = new Map<string, [Diagram, DiagramNode]>();

const makeDiagramNode = (diagram: Diagram, n: Stencil, pkg: string) => {
  const cacheKey = pkg + '/' + n.id;

  if (NODE_CACHE.has(cacheKey)) {
    return NODE_CACHE.get(cacheKey)!;
  }

  const uow = UnitOfWork.immediate(diagram);

  const dest = new Diagram(
    newid(),
    n.node.name,
    new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
  );

  const layer = new RegularLayer('default', 'Default', [], dest);
  dest.layers.add(layer, uow);

  const node = n.node(dest);
  dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  dest.viewBox.offset = { x: -5, y: -5 };
  layer.addElement(node, uow);

  NODE_CACHE.set(cacheKey, [dest, node]);

  return [dest, node] as const;
};

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const [showHover, setShowHover] = useState(true);
  const app = useApplication();

  const stencils = props.package.stencils;
  const diagrams = useMemo(() => {
    return stencils.map(n => makeDiagramNode(diagram, n, props.package.id));
  }, [diagram, stencils]);

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map(([d, node], idx) => (
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
              DRAG_DROP_MANAGER.initiate(new ObjectPickerDrag(ev, node, diagram, app), () =>
                setShowHover(true)
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
  package: StencilPackage;
};
