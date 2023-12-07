import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { useDiagramProperty } from './useProperty.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbGrid3X3, TbGridDots } from 'react-icons/tb';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';

export const CanvasGridProperties = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('canvaschanged', redraw, props.diagram);
  const [bg, setBg] = useDiagramProperty<string>('background.color', props.diagram, 'none');

  return (
    <Accordion.Item className="cmp-accordion__item" value="line">
      <AccordionTrigger>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            className="cmp-accordion__enabled"
            type={'checkbox'}
            checked={true}
            onChange={() => {}}
            onClick={e => {
              console.log(e);
            }}
          />
          <span>Stroke</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Major</div>
          <div
            className={'cmp-labeled-table__value'}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={bg ?? 'transparent'}
              onClick={v => {
                setBg(v);
              }}
            />
            &nbsp;
            <NumberInput
              style={{ width: '45px' }}
              value={0}
              onChange={() => {}}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <ReactToolbar.Root className="cmp-toolbar" aria-label="Grid type">
              <ReactToolbar.ToggleGroup type={'single'} value={'grid'}>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'grid'}>
                  <TbGrid3X3 />
                </ReactToolbar.ToggleItem>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'dots'}>
                  <TbGridDots />
                </ReactToolbar.ToggleItem>
              </ReactToolbar.ToggleGroup>
            </ReactToolbar.Root>
          </div>

          <div className={'cmp-labeled-table__label'}>Minor</div>
          <div
            className={'cmp-labeled-table__value'}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={bg ?? 'transparent'}
              onClick={v => {
                setBg(v);
              }}
            />
            &nbsp;
            <NumberInput
              style={{ width: '45px' }}
              value={0}
              onChange={() => {}}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <ReactToolbar.Root className="cmp-toolbar" aria-label="Grid type">
              <ReactToolbar.ToggleGroup type={'single'} value={'grid'}>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'grid'}>
                  <TbGrid3X3 />
                </ReactToolbar.ToggleItem>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'dots'}>
                  <TbGridDots />
                </ReactToolbar.ToggleItem>
              </ReactToolbar.ToggleGroup>
            </ReactToolbar.Root>
          </div>
        </div>
      </AccordionContent>
    </Accordion.Item>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
