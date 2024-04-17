import { useDiagram } from './context/DiagramContext';
import { PickerCanvas } from './PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const nodes = diagram.document.nodeDefinitions.getForGroup(props.group);

  const diagrams = nodes
    .filter(n => n.type !== 'group')
    .map(n => {
      const ar = n.getDefaultAspectRatio();

      const margin = 1;

      const maxWidth = props.size - 2 * margin;
      const maxHeight = props.size - 2 * margin;

      const w = ar < 1 ? maxWidth * ar : maxWidth;
      const h = ar < 1 ? maxHeight : maxHeight / ar;

      const x = (maxWidth - w) / 2 + margin;
      const y = (maxHeight - h) / 2 + margin;

      const dest = new Diagram(
        n.type,
        n.type,
        new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
      );
      dest.layers.add(new Layer('default', 'Default', [], dest), UnitOfWork.throwaway(dest));
      dest.layers.active.addElement(
        new DiagramNode(
          n.type,
          n.type,
          { x, y, w, h, r: 0 },
          dest,
          dest.layers.active,
          n.getDefaultProps('picker')
        ),
        new UnitOfWork(dest)
      );

      return dest;
    });

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map((d, idx) => (
        <div
          key={idx}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', nodes[idx].type);
            ev.dataTransfer.setData('application/x-diagram-craft-node-type', nodes[idx].type);
          }}
          style={{ background: 'transparent' }}
        >
          <PickerCanvas width={props.size} height={props.size} diagram={d} />
        </div>
      ))}
    </div>
  );
};

type Props = {
  size: number;
  group?: string | undefined;
};
