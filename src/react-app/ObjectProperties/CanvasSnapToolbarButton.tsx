import { TbMagnet } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { EditableDiagram, SnapManagerConfigProps } from '../../model-editor/editable-diagram.ts';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { useProperty } from './useProperty2.ts';

export const CanvasSnapToolbarButton = (props: Props) => {
  const [enabled, setEnabled] = useProperty<SnapManagerConfigProps>(
    props.diagram.snapManagerConfig,
    'enabled',
    true
  );

  return (
    <ToolbarToggleItemWithPopover value={!!enabled} onChange={setEnabled} icon={TbMagnet}>
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
