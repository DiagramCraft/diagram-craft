import { Diagram } from '@diagram-craft/model/diagram';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbBoxMultiple, TbLine, TbRectangle, TbTable, TbTableRow } from 'react-icons/tb';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { shorten } from '@diagram-craft/utils/strings';
import { Tree } from '@diagram-craft/app-components/Tree';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

export const SelectToolWindow = (props: Props) => {
  const redraw = useRedraw();

  const names = Object.fromEntries(
    props.diagram.layers.all.flatMap(l =>
      l instanceof RegularLayer ? l.elements.map(e => [e.id, e.name]) : []
    )
  );

  useEventListener(props.diagram.selectionState, 'add', redraw);
  useEventListener(props.diagram.selectionState, 'remove', redraw);
  useEventListener(props.diagram, 'change', redraw);
  useEventListener(props.diagram, 'elementChange', ({ element }) => {
    if (names[element.id] !== element.name) {
      redraw();
    }
  });

  const selection = props.diagram.selectionState;
  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['selection']}>
      <Accordion.Item value="selection">
        <Accordion.ItemHeader>Selection</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <Tree.Root>
            <Tree.Node isOpen={true}>
              <Tree.NodeLabel>Selected elements</Tree.NodeLabel>
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
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: Diagram;
};
