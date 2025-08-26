import { useSnapManagerProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ActionCheckbox } from '../../components/ActionCheckbox';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useDiagram } from '../../../application';

export const CanvasSnapPanel = (props: Props) => {
  const diagram = useDiagram();
  const enabled = useSnapManagerProperty(diagram, 'enabled', true);
  const threshold = useSnapManagerProperty(diagram, 'threshold', 5);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Snap'}
      id={'snap'}
      hasCheckbox={true}
      value={!!enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label util-a-top'}>Snap:</div>
        <div className={'cmp-labeled-table__value util-vstack'}>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_GRID'}>Snap to grid</ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_GUIDES'}>Snap to guides</ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_NODE'}>
              Snap to object bounds
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_CANVAS'}>
              Snap to canvas midpoint
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_DISTANCE'}>
              Snap to object size
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox action={'TOGGLE_MAGNET_TYPE_SIZE'}>
              Snap to object distance
            </ActionCheckbox>
          </div>
        </div>

        <div className={'cmp-labeled-table__label'}>Threshold:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            style={{ width: '45px' }}
            value={threshold.val.toString()}
            onChange={a => threshold.set(a!)}
            validUnits={['px']}
            defaultUnit={'px'}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
