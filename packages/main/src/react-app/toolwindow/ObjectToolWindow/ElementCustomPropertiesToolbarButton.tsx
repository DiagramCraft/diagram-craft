import { TbSettings } from 'react-icons/tb';
import { ElementCustomPropertiesPanel } from './ElementCustomPropertiesPanel';
import { useEffect, useState } from 'react';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useDiagram } from '../../../application';

export const ElementCustomPropertiesToolbarButton = () => {
  const diagram = useDiagram();
  const [node, setNode] = useState<DiagramNode | undefined>(undefined);

  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selection.type;
      if (selectionType !== 'single-node' && selectionType !== 'single-label-node') {
        setNode(undefined);
      } else {
        setNode(diagram.selection.nodes[0]);
      }
    };
    callback();

    diagram.selection.on('change', callback);
    return () => {
      diagram.selection.off('change', callback);
    };
  }, [diagram.selection]);

  if (!node) {
    return null;
  }

  let disabled = false;

  const def = diagram.document.nodeDefinitions.get(node.nodeType);
  const customProperties = def.getCustomPropertyDefinitions(node);
  if (Object.keys(customProperties).length === 0) {
    disabled = true;
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        element={
          <Toolbar.Button disabled={disabled}>
            <TbSettings />
          </Toolbar.Button>
        }
      />
      <Popover.Content sideOffset={5}>
        <ElementCustomPropertiesPanel mode={'panel'} />
      </Popover.Content>
    </Popover.Root>
  );
};
