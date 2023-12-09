import { TbGrid3X3 } from 'react-icons/tb';
import { CanvasGridPanel } from './CanvasGridPanel.tsx';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { useDiagramProperty } from './useProperty.ts';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';

export const CanvasGridToolbarButton = (props: Props) => {
  const [gridEnabled, setGridEnabled] = useDiagramProperty(props.diagram, 'grid.enabled', true);

  return (
    <ToolbarToggleItemWithPopover value={!!gridEnabled} onChange={setGridEnabled} icon={TbGrid3X3}>
      <CanvasGridPanel
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
