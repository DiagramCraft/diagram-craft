import { TbStackBackward } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { ShadowPanel } from './ShadowPanel.tsx';
import { useNodeProperty } from './useProperty.ts';

export const ShadowToolbarButton = (props: Props) => {
  const $d = props.diagram;
  const [enabled, setEnabled] = useNodeProperty($d, 'shadow.enabled', false);

  return (
    <ToolbarToggleItemWithPopover value={!!enabled} onChange={setEnabled} icon={TbStackBackward}>
      <ShadowPanel diagram={props.diagram} mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};

type Props = {
  diagram: EditableDiagram;
};
