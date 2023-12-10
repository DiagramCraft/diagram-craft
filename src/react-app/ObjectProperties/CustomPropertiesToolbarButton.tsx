import { TbSettings } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { ToolbarButtonWithPopover } from '../components/ToolbarButtonWithPopover.tsx';
import { CustomPropertiesPanel } from './CustomPropertiesPanel.tsx';
import { useEffect, useState } from 'react';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';

export const CustomPropertiesToolbarButton = (props: Props) => {
  const [node, setNode] = useState<DiagramNode | undefined>(undefined);

  useEffect(() => {
    const callback = () => {
      if (
        props.diagram.selectionState.nodes.length !== 1 ||
        props.diagram.selectionState.edges.length !== 0
      ) {
        setNode(undefined);
      } else {
        setNode(props.diagram.selectionState.nodes[0]);
      }
    };
    callback();

    props.diagram.selectionState.on('change', callback);
    return () => {
      props.diagram.selectionState.off('change', callback);
    };
  }, [props.diagram.selectionState]);

  if (!node) {
    return null;
  }

  let disabled = false;

  const def = props.diagram.nodeDefinitions.get(node.nodeType)!;
  const customProperties = def.getCustomProperties(node);
  if (Object.keys(customProperties).length === 0) {
    disabled = true;
  }

  return (
    <ToolbarButtonWithPopover icon={TbSettings} disabled={disabled}>
      <CustomPropertiesPanel diagram={props.diagram} mode={'panel'} />
    </ToolbarButtonWithPopover>
  );
};

type Props = {
  diagram: EditableDiagram;
};
