import { ColorPicker } from '../components/ColorPicker.tsx';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useProperty.ts';
import { NumberInput } from '../components/NumberInput.tsx';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import { PopoverButton } from '../components/PopoverButton.tsx';

export const NodeStrokePanel = (props: Props) => {
  const $d = useDiagram();
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
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={strokeColor.val}
            onClick={strokeColor.set}
            hasMultipleValues={strokeColor.hasMultipleValues}
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
