import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useNodeProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Popover from '@radix-ui/react-popover';
import { TbAdjustmentsHorizontal, TbX } from 'react-icons/tb';
import React from 'react';

export const StrokeProperties = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  const [strokeColor, setStrokeColor] = useNodeProperty(
    'stroke.color',
    props.diagram,
    'transparent'
  );
  const [pattern, setPattern] = useNodeProperty('stroke.pattern', props.diagram, 'SOLID');

  const [strokSize, setStrokeSize] = useNodeProperty('stroke.patternSize', props.diagram, '100');
  const [strokeSpacing, setStrokeSpacing] = useNodeProperty(
    'stroke.patternSpacing',
    props.diagram,
    '100'
  );
  const [strokeWidth, setStrokeWidth] = useNodeProperty('stroke.width', props.diagram, '1');

  return (
    <>
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
              onChange={ev => {
                setStrokeWidth(ev?.toString());
              }}
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
                      onChange={ev => {
                        setStrokeSize(ev?.toString());
                      }}
                    />
                    &nbsp;
                    <NumberInput
                      validUnits={['%']}
                      defaultUnit={'%'}
                      value={strokeSpacing ?? 100}
                      min={1}
                      style={{ width: '45px' }}
                      onChange={ev => {
                        setStrokeSpacing(ev?.toString());
                      }}
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
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
