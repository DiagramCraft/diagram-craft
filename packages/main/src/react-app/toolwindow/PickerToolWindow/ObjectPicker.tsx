import { useDiagram } from '../../context/DiagramContext';
import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { newid } from '@diagram-craft/utils/id';
import { Stencil, StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useMemo, useState } from 'react';
import { Browser } from '@diagram-craft/canvas/browser';

const encodeSvg = (svgString: string) => svgString.replace('«', '&#171;').replace('»', '&#187;');

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

  dest.layers.add(new Layer('default', 'Default', [], dest), uow);

  const node = n.node(dest);
  dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  dest.viewBox.offset = { x: -5, y: -5 };
  dest.layers.active.addElement(node, uow);

  NODE_CACHE.set(cacheKey, [dest, node]);

  return [dest, node] as const;
};

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const [showHover, setShowHover] = useState(true);

  const stencils = props.package.stencils;
  const diagrams = useMemo(() => {
    return stencils.map(n => makeDiagramNode(diagram, n, props.package.id));
  }, [diagram, stencils]);

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map(([d, n], idx) => (
        <div
          key={d.id}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', props.package + '/' + stencils[idx].id);

            // Note: we know for a fact that there's only one layer in the diagram
            const elements = d.layers.active.elements;
            ev.dataTransfer.setData(
              'application/x-diagram-craft-elements',
              JSON.stringify({
                elements: elements.map(e => serializeDiagramElement(e)),
                attachments: {},
                dimensions: n.bounds
              })
            );

            const clonedSvg = (
              ev.target as HTMLElement
            ).firstElementChild?.firstElementChild?.firstElementChild!.cloneNode(
              true
            ) as HTMLElement;
            clonedSvg.setAttribute('width', n.bounds.w.toString());
            clonedSvg.setAttribute('height', n.bounds.h.toString());

            const canvasFg = getComputedStyle(document.getElementById('app')!).getPropertyValue(
              '--canvas-fg'
            );
            const canvasBg = getComputedStyle(document.getElementById('app')!).getPropertyValue(
              '--canvas-bg'
            );
            const canvasBg2 = getComputedStyle(document.getElementById('app')!).getPropertyValue(
              '--canvas-bg2'
            );

            clonedSvg.setAttribute(
              'style',
              `--canvas-fg: ${canvasFg}; --canvas-bg: ${canvasBg}; --canvas-bg2: ${canvasBg2};`
            );
            clonedSvg.setAttribute('viewBox', `-2 -2 ${n.bounds.w + 4} ${n.bounds.h + 4}`);

            const canvas = document.createElement('canvas');
            canvas.width = n.bounds.w * 2;
            canvas.height = n.bounds.h * 2;

            const ctx = canvas.getContext('2d')!;
            ctx.scale(2, 2);

            const img = new Image();
            const svgData = encodeSvg(new XMLSerializer().serializeToString(clonedSvg));

            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
            ctx.drawImage(img, 0, 0);

            const div = document.createElement('div');
            div.id = 'drag-image';

            const dragImage = new Image();
            dragImage.src = canvas.toDataURL('image/png');
            dragImage.width = n.bounds.w;
            dragImage.height = n.bounds.h;

            div.style.position = 'absolute';

            document.body.style.overflow = 'hidden';
            div.style.zIndex = '1000';
            div.style.top = '100%';
            div.style.left = '100%';
            div.appendChild(img);
            document.body.appendChild(div);

            if (Browser.isChrome()) {
              ev.dataTransfer.setDragImage(div, 2, 2);
            }

            canvas.remove();

            setShowHover(false);
          }}
          onDragEnd={() => {
            setShowHover(true);
            document.getElementById('drag-image')?.remove();
          }}
          style={{ background: 'transparent' }}
          data-width={d.viewBox.dimensions.w}
        >
          <PickerCanvas
            width={props.size}
            height={props.size}
            diagramWidth={d.viewBox.dimensions.w}
            diagramHeight={d.viewBox.dimensions.h}
            diagram={d}
            showHover={showHover}
            name={
              stencils[idx].name ??
              diagram.document.nodeDefinitions.get(n.nodeType).name ??
              'unknown'
            }
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
