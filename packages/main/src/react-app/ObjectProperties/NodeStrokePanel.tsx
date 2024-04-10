import { ColorPicker } from '../components/ColorPicker';
import { DashSelector } from './DashSelector';
import { useNodeProperty } from './useProperty';
import { NumberInput } from '../components/NumberInput';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../context/DiagramContext';
import { useNodeDefaults } from '../useDefaults';
import { PopoverButton } from '../components/PopoverButton';
import { useConfiguration } from '../context/ConfigurationContext';

export const NodeStrokePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const defaults = useNodeDefaults();

  const strokeColor = useNodeProperty($d, 'stroke.color', defaults.stroke.color);
  const pattern = useNodeProperty($d, 'stroke.pattern', defaults.stroke.pattern);

  const strokeSize = useNodeProperty($d, 'stroke.patternSize', defaults.stroke.patternSize);
  const strokeSpacing = useNodeProperty($d, 'stroke.patternSpacing', defaults.stroke.patternSize);
  const strokeWidth = useNodeProperty($d, 'stroke.width', defaults.stroke.width);
  const enabled = useNodeProperty($d, 'stroke.enabled', defaults.stroke.enabled);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stroke"
      title={'Stroke'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={strokeColor.val}
            onChange={strokeColor.set}
            hasMultipleValues={strokeColor.hasMultipleValues}
            customPalette={$d.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <NumberInput
            defaultUnit={'px'}
            value={strokeWidth.val}
            min={1}
            style={{ width: '35px' }}
            onChange={strokeWidth.set}
            hasMultipleValues={strokeWidth.hasMultipleValues}
          />
          <DashSelector
            value={pattern.val}
            onValueChange={value => {
              pattern.set(value);
            }}
            hasMultipleValues={pattern.hasMultipleValues}
          />
          <PopoverButton label={<TbAdjustmentsHorizontal />}>
            <h2>Stroke</h2>
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={strokeSize.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokeSize.set}
            />
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={strokeSpacing.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokeSpacing.set}
            />
          </PopoverButton>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
