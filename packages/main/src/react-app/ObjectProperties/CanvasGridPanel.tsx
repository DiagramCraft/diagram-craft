import { useRedraw } from '../useRedraw';
import { useEventListener } from '../hooks/useEventListener';
import { ColorPicker } from '../components/ColorPicker';
import { useDiagramProperty } from './useProperty';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbGrid3X3, TbGridDots } from 'react-icons/tb';
import { NumberInput } from '../components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { assertGridType } from '@diagram-craft/model';
import { useDiagram } from '../context/DiagramContext';
import { useConfiguration } from '../context/ConfigurationContext';

export const CanvasGridPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const redraw = useRedraw();
  useEventListener($d, 'change', redraw);

  const size = useDiagramProperty($d, 'grid.size', 10);
  const majorCount = useDiagramProperty($d, 'grid.majorCount', 5);
  const color = useDiagramProperty($d, 'grid.color', '#f5f5f4');
  const majorColor = useDiagramProperty($d, 'grid.majorColor', '#e7e5e4');
  const type = useDiagramProperty($d, 'grid.type', 'lines');
  const majorType = useDiagramProperty($d, 'grid.majorType', 'lines');
  const enabled = useDiagramProperty($d, 'grid.enabled', true);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Grid'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
      id={'grid'}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Base</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={color.val ?? 'transparent'}
            onChange={color.set}
            customPalette={$d.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          />
          <NumberInput
            style={{ width: '45px' }}
            value={size.val ?? 10}
            onChange={n => size.set(n ?? 0)}
            validUnits={['px']}
            defaultUnit={'px'}
          />
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Grid type">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={type.val}
              onValueChange={v => {
                assertGridType(v);
                type.set(v);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'lines'}>
                <TbGrid3X3 />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'dots'}>
                <TbGridDots />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Major</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={majorColor.val ?? 'transparent'}
            onChange={majorColor.set}
            customPalette={$d.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          />
          <NumberInput
            style={{ width: '45px' }}
            value={majorCount.val ?? 5}
            onChange={n => majorCount.set(n ?? 0)}
          />
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Grid type">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={majorType.val}
              onValueChange={v => {
                assertGridType(v);
                majorType.set(v);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'lines'}>
                <TbGrid3X3 />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'dots'}>
                <TbGridDots />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
