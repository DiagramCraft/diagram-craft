import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ActionToggleItem } from '../toolbar/ActionToggleItem.tsx';
import {
  TbArrowAutofitWidth,
  TbArrowsMoveHorizontal,
  TbGrid3X3,
  TbLayout,
  TbPlus
} from 'react-icons/tb';
import { ActionToggleGroup } from '../toolbar/ActionToggleGroup.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';

export const CanvasSnapProperties = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('canvaschanged', redraw, props.diagram);

  return (
    <Accordion.Item className="cmp-accordion__item" value="snap">
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
          <span>Snap</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className={'cmp-labeled-table'}>
          <div
            className={'cmp-labeled-table__label'}
            style={{ alignSelf: 'start', marginTop: '0.25rem' }}
          >
            Snap:
          </div>
          <div className={'cmp-labeled-table__value'}>
            <div>
              <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
                <ActionToggleGroup {...props}>
                  <ActionToggleItem action={'TOGGLE_MAGNET_TYPE_GRID'} {...props}>
                    <TbGrid3X3 />
                  </ActionToggleItem>
                  <ActionToggleItem action={'TOGGLE_MAGNET_TYPE_NODE'} {...props}>
                    <TbLayout />
                  </ActionToggleItem>
                  <ActionToggleItem action={'TOGGLE_MAGNET_TYPE_CANVAS'} {...props}>
                    <TbPlus />
                  </ActionToggleItem>
                  <ActionToggleItem action={'TOGGLE_MAGNET_TYPE_DISTANCE'} {...props}>
                    <TbArrowsMoveHorizontal />
                  </ActionToggleItem>
                  <ActionToggleItem action={'TOGGLE_MAGNET_TYPE_SIZE'} {...props}>
                    <TbArrowAutofitWidth />
                  </ActionToggleItem>
                </ActionToggleGroup>{' '}
              </ReactToolbar.Root>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
              <NumberInput
                style={{ width: '45px' }}
                value={5}
                onChange={() => {}}
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
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
