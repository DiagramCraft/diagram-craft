import { EditableDiagram, SnapManagerConfigProps } from '../../model-editor/editable-diagram.ts';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { NumberInput } from '../NumberInput.tsx';
import { ActionCheckbox } from '../components/ActionCheckbox.tsx';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { useProperty } from './useProperty2.ts';

export const CanvasSnapPanel = (props: Props) => {
  const snapMgr = props.diagram.snapManagerConfig;

  const [enabled, setEnabled] = useProperty<SnapManagerConfigProps>(snapMgr, 'enabled', true);
  const [threshold, setThreshold] = useProperty<SnapManagerConfigProps>(snapMgr, 'threshold', 5);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Snap'}
      id={'snap'}
      hasCheckbox={true}
      value={!!enabled}
      onChange={setEnabled}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label util-a-top'}>Snap:</div>
        <div className={'cmp-labeled-table__value util-vstack'}>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_GRID'}>
              Snap to grid
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_NODE'}>
              Snap to object bounds
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_CANVAS'}>
              Snap to canvas midpoint
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_DISTANCE'}>
              Snap to object size
            </ActionCheckbox>
          </div>
          <div className={'util-vcenter util-vgap util-font-body'}>
            <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_SIZE'}>
              Snap to object distance
            </ActionCheckbox>
          </div>
        </div>

        <div className={'cmp-labeled-table__label'}>Threshold:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            style={{ width: '45px' }}
            value={(threshold ?? 0)?.toString()}
            /* @ts-ignore */
            onChange={setThreshold}
            validUnits={['px']}
            defaultUnit={'px'}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
  mode?: 'accordion' | 'panel';
};
