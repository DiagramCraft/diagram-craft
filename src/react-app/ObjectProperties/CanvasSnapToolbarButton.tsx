import { TbMagnet } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { useSnapManagerProperty } from './useProperty.ts';

export const CanvasSnapToolbarButton = (props: Props) => {
  const enabled = useSnapManagerProperty(props.diagram, 'enabled', true);

  return (
    <ToolbarToggleItemWithPopover value={!!enabled.val} onChange={enabled.set} icon={TbMagnet}>
      <CanvasSnapPanel
        diagram={props.diagram}
        keyMap={props.keyMap}
        actionMap={props.actionMap}
        mode={'panel'}
      />
    </ToolbarToggleItemWithPopover>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
