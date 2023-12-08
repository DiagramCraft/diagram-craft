import { TbMagnet } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';

export const CanvasSnapToolbarButton = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('change', redraw, props.diagram.snapManagerConfig);

  const snapEnabled = props.diagram.snapManagerConfig.enabled;
  return (
    <ToolbarToggleItemWithPopover
      value={snapEnabled}
      onChange={v => {
        props.diagram.snapManagerConfig.enabled = v;
      }}
      icon={TbMagnet}
    >
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
