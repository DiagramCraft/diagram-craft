import { useDiagram } from '../../context/DiagramContext';
import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { newid } from '@diagram-craft/utils/id';
import { StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useState } from 'react';

const encodeSvg = (svgString: string) =>
  'data:image/svg+xml,' +
  svgString
    .replace(
      '<svg',
      ~svgString.indexOf('xmlns') ? '<svg' : '<svg xmlns="http://www.w3.org/2000/svg"'
    )
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\s+/g, ' ');

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const [showHover, setShowHover] = useState(true);

  const stencils = props.package.stencils;
  const diagrams = stencils.map((n): [Diagram, DiagramNode] => {
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

    return [dest, node];
  });

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map(([d, n], idx) => (
        <div
          key={idx}
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

            const div = document.createElement('div');
            div.id = 'drag-image';

            const img = new Image();
            img.src = encodeSvg(clonedSvg.outerHTML);
            img.width = n.bounds.w;
            img.height = n.bounds.h;

            div.style.position = 'absolute';

            div.style.zIndex = '1000';
            div.style.top = '100%';
            div.style.left = '100%';
            div.appendChild(img);
            document.body.appendChild(div);

            ev.dataTransfer.setDragImage(img, 2, 2);
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
