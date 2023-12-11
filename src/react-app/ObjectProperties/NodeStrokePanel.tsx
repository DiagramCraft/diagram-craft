import { ColorPicker } from '../ColorPicker.tsx';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Popover from '@radix-ui/react-popover';
import { TbAdjustmentsHorizontal, TbX } from 'react-icons/tb';
import React from 'react';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';

export const NodeStrokePanel = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  const $d = useDiagram();

  const strokeColor = useNodeProperty($d, 'stroke.color', 'transparent');
  const pattern = useNodeProperty($d, 'stroke.pattern', 'SOLID');

  const strokeSize = useNodeProperty($d, 'stroke.patternSize', 100);
  const strokeSpacing = useNodeProperty($d, 'stroke.patternSpacing', 100);
  const strokeWidth = useNodeProperty($d, 'stroke.width', 1);
  const enabled = useNodeProperty($d, 'stroke.enabled', true);

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
            color={strokeColor.val ?? 'transparent'}
            onClick={strokeColor.set}
            hasMultipleValues={strokeColor.hasMultipleValues}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <NumberInput
              validUnits={['px']}
              defaultUnit={'px'}
              value={strokeWidth.val ?? 1}
              min={1}
              style={{ width: '35px' }}
              onChange={strokeWidth.set}
              hasMultipleValues={strokeWidth.hasMultipleValues}
            />
            &nbsp;
            <DashSelector
              value={pattern.val}
              onValueChange={value => {
                pattern.set(value);
              }}
              hasMultipleValues={pattern.hasMultipleValues}
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
                      value={strokeSize.val ?? 100}
                      min={1}
                      style={{ width: '45px' }}
                      onChange={strokeSize.set}
                    />
                    &nbsp;
                    <NumberInput
                      validUnits={['%']}
                      defaultUnit={'%'}
                      value={strokeSpacing.val ?? 100}
                      min={1}
                      style={{ width: '45px' }}
                      onChange={strokeSpacing.set}
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
  mode?: 'accordion' | 'panel';
};
