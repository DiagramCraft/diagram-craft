import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Popover from '@radix-ui/react-popover';
import { TbAdjustmentsHorizontal, TbX } from 'react-icons/tb';
import React from 'react';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';

export const NodeStrokePanel = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  const $d = props.diagram;

  const [strokeColor, setStrokeColor] = useNodeProperty('stroke.color', $d, 'transparent');
  const [pattern, setPattern] = useNodeProperty('stroke.pattern', $d, 'SOLID');

  const [strokSize, setStrokeSize] = useNodeProperty('stroke.patternSize', $d, 100);
  const [strokeSpacing, setStrokeSpacing] = useNodeProperty('stroke.patternSpacing', $d, 100);
  const [strokeWidth, setStrokeWidth] = useNodeProperty('stroke.width', $d, 1);
  const [enabled, setEnabled] = useNodeProperty('stroke.enabled', $d, true);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stroke"
      title={'Stroke'}
      hasCheckbox={true}
      value={enabled}
      onChange={setEnabled}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={strokeColor ?? 'transparent'}
            onClick={setStrokeColor}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <NumberInput
              validUnits={['px']}
              defaultUnit={'px'}
              value={strokeWidth ?? 1}
              min={1}
              style={{ width: '35px' }}
              onChange={setStrokeWidth}
            />
            &nbsp;
            <DashSelector
              value={pattern}
              onValueChange={value => {
                setPattern(value);
              }}
            />
            &nbsp;
            <div className={'cmp-more'}>
              <Popover.Root open={open} onOpenChange={o => setOpen(o)}>
                <Popover.Trigger asChild>
                  <button>
                    <TbAdjustmentsHorizontal />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content className="cmp-popover" sideOffset={5}>
                    <h2>Stroke</h2>
                    &nbsp;
                    <NumberInput
                      validUnits={['%']}
                      defaultUnit={'%'}
                      value={strokSize ?? 100}
                      min={1}
                      style={{ width: '45px' }}
                      onChange={setStrokeSize}
                    />
                    &nbsp;
                    <NumberInput
                      validUnits={['%']}
                      defaultUnit={'%'}
                      value={strokeSpacing ?? 100}
                      min={1}
                      style={{ width: '45px' }}
                      onChange={setStrokeSpacing}
                    />
                    <Popover.Close className="cmp-popover__close" aria-label="Close">
                      <TbX />
                    </Popover.Close>
                    <Popover.Arrow className="cmp-popover__arrow" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  diagram: EditableDiagram;
  mode?: 'accordion' | 'panel';
};
