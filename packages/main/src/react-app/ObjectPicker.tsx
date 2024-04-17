import { useDiagram } from './context/DiagramContext';
import { PickerCanvas } from './PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { deepMerge } from '@diagram-craft/utils/object';

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const nodes = diagram.document.nodeDefinitions.getForGroup(props.group);

  const diagrams = nodes.map(n => {
    const dest = new Diagram(
      n.node.type,
      n.node.type,
      new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
    );
    dest.layers.add(new Layer('default', 'Default', [], dest), UnitOfWork.throwaway(dest));

    const node = new DiagramNode(
      n.node.type,
      n.node.type,
      { x: 1, y: 1, w: 10, h: 10, r: 0 },
      dest,
      dest.layers.active,
      deepMerge(n.node.getDefaultProps('picker'), n.props ?? {})
    );
    dest.layers.active.addElement(node, new UnitOfWork(dest));

    // Adjust size
    const ar = n.node.getDefaultAspectRatio(node);

    const margin = 1;

    const maxWidth = props.size - 2 * margin;
    const maxHeight = props.size - 2 * margin;

    const w = ar < 1 ? maxWidth * ar : maxWidth;
    const h = ar < 1 ? maxHeight : maxHeight / ar;

    const x = (maxWidth - w) / 2 + margin;
    const y = (maxHeight - h) / 2 + margin;

    node.setBounds({ x, y, w, h, r: 0 }, UnitOfWork.throwaway(diagram));

    return dest;
  });

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map((d, idx) => (
        <div
          key={idx}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', nodes[idx].node.type);
            ev.dataTransfer.setData('application/x-diagram-craft-node-type', nodes[idx].node.type);
            ev.dataTransfer.setData('application/x-diagram-craft-node-key', nodes[idx].key ?? '');
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
