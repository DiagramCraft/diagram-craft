import { TbSettings } from 'react-icons/tb';
import { ElementCustomPropertiesPanel } from './ElementCustomPropertiesPanel';
import { useEffect, useState } from 'react';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useDiagram } from '../../context/DiagramContext';
import { ToolbarButtonWithPopover } from '../../components/ToolbarButtonWithPopover';

export const ElementCustomPropertiesToolbarButton = () => {
  const diagram = useDiagram();
  const [node, setNode] = useState<DiagramNode | undefined>(undefined);

  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selectionState.getSelectionType();
      if (selectionType !== 'single-node' && selectionType !== 'single-label-node') {
        setNode(undefined);
      } else {
        setNode(diagram.selectionState.nodes[0]);
      }
    };
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [diagram.selectionState]);

  if (!node) {
    return null;
  }

  let disabled = false;

  const def = diagram.document.nodeDefinitions.get(node.nodeType)!;
  const customProperties = def.getCustomProperties(node);
  if (Object.keys(customProperties).length === 0) {
    disabled = true;
  }

  return (
    <ToolbarButtonWithPopover icon={TbSettings} disabled={disabled}>
      <ElementCustomPropertiesPanel mode={'panel'} />
    </ToolbarButtonWithPopover>
  );
};
