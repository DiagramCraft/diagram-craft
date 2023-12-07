import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useNodeProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionContent } from '../AccordionContext.tsx';
import { useRef } from 'react';

export const ShadowProperties = (props: Props) => {
  const [color, setColor] = useNodeProperty<string | undefined>(
    'shadow.color',
    props.diagram,
    'black'
  );
  const [opacity, setOpacity] = useNodeProperty<number | undefined>(
    'shadow.opacity',
    props.diagram,
    0.5
  );
  const [x, setX] = useNodeProperty<number | undefined>('shadow.x', props.diagram, 5);
  const [y, setY] = useNodeProperty<number | undefined>('shadow.y', props.diagram, 5);
  const [blur, setBlur] = useNodeProperty<number | undefined>('shadow.blur', props.diagram, 5);
  const [enabled, setEnabled] = useNodeProperty<boolean | undefined>(
    'shadow.enabled',
    props.diagram,
    false
  );

  const ref = useRef<HTMLButtonElement>(null);

  return (
    <Accordion.Item className="cmp-accordion__item" value="shadow">
      <AccordionTrigger ref={ref}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            className="cmp-accordion__enabled"
            type={'checkbox'}
            checked={enabled}
            onChange={() => {
              setEnabled(!enabled);
            }}
            onClick={e => {
              if (enabled || ref.current?.dataset['state'] === 'open') {
                e.stopPropagation();
              }
            }}
          />
          <span>Shadow</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Color:</div>
          <div className={'cmp-labeled-table__value'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ColorPicker
                primaryColors={primaryColors}
                additionalHues={additionalHues}
                color={color ?? 'black'}
                onClick={setColor}
              />
              &nbsp;
              <NumberInput
                value={round((1 - (opacity ?? 0)) * 100)?.toString() ?? ''}
                onChange={v => setOpacity((100 - (v ?? 100)) / 100)}
                style={{ width: '45px' }}
                min={0}
                max={100}
                validUnits={['%']}
                defaultUnit={'%'}
              />
            </div>
          </div>
          <div className={'cmp-labeled-table__label'}>Position:</div>
          <div className={'cmp-labeled-table__value'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <NumberInput
                value={x?.toString() ?? ''}
                onChange={setX}
                style={{ width: '45px' }}
                validUnits={['px']}
                defaultUnit={'px'}
              />
              &nbsp;
              <NumberInput
                value={y?.toString() ?? ''}
                onChange={setY}
                style={{ width: '45px' }}
                validUnits={['px']}
                defaultUnit={'px'}
              />
              &nbsp;
              <NumberInput
                value={blur?.toString() ?? ''}
                onChange={setBlur}
                min={0}
                style={{ width: '45px' }}
                validUnits={['px']}
                defaultUnit={'px'}
              />
            </div>
          </div>
        </div>
      </AccordionContent>
    </Accordion.Item>
  );
};

type Props = {
  diagram: EditableDiagram;
};
