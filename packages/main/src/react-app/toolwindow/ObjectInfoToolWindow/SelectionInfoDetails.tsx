import { Tree } from '@diagram-craft/app-components/Tree';
import { SelectionState } from '@diagram-craft/model/selectionState';
import { ObjectTreeNode } from './ObjectTreeNode';
import { useRedraw } from '../../hooks/useRedraw';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { useEventListener } from '../../hooks/useEventListener';
import { TbBoxMultiple, TbLine, TbRectangle, TbTable, TbTableRow } from 'react-icons/tb';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { shorten } from '@diagram-craft/utils/strings';
import { useDiagram } from '../../../application';

export const SelectionInfoDetails = (props: { obj: SelectionState }) => {
  const redraw = useRedraw();
  const diagram = useDiagram();

  const names = Object.fromEntries(
    diagram.layers.all.flatMap(l =>
      l instanceof RegularLayer ? l.elements.map(e => [e.id, e.name]) : []
    )
  );

  useEventListener(diagram.selectionState, 'add', redraw);
  useEventListener(diagram.selectionState, 'remove', redraw);
  useEventListener(diagram, 'change', redraw);
  useEventListener(diagram, 'elementChange', ({ element }) => {
    if (names[element.id] !== element.name) {
      redraw();
    }
  });

  const selection = diagram.selectionState;

  return (
    <Tree.Root>
      <Tree.Node>
        <Tree.NodeLabel>bounds</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.bounds} />
        </Tree.Children>
      </Tree.Node>

      <Tree.Node isOpen={true}>
        <Tree.NodeLabel>elements</Tree.NodeLabel>
        <Tree.Children>
          <div style={{ display: 'contents' }}>
            {selection.elements.map(e => {
              let icon = <TbRectangle />;
              if (isEdge(e)) {
                icon = <TbLine />;
              } else if (isNode(e) && e.nodeType === 'group') {
                icon = <TbBoxMultiple />;
              } else if (isNode(e) && e.nodeType === 'table') {
                icon = <TbTable />;
              } else if (isNode(e) && e.nodeType === 'tableRow') {
                icon = <TbTableRow />;
              }

              return (
                <Tree.Node key={e.id}>
                  <Tree.NodeLabel>
                    {icon} &nbsp;{shorten(e.name, 25)}
                  </Tree.NodeLabel>
                </Tree.Node>
              );
            })}
          </div>
        </Tree.Children>
      </Tree.Node>
    </Tree.Root>
  );
};
