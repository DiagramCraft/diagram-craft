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
import { useRef } from 'react';

export const CanvasSnapProperties = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('canvaschanged', redraw, props.diagram);
  useEventListener('change', redraw, props.diagram.snapManagerConfig);

  const ref = useRef<HTMLButtonElement>(null);

  return (
    <Accordion.Item className="cmp-accordion__item" value="snap">
      <AccordionTrigger>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            className="cmp-accordion__enabled"
            type={'checkbox'}
            checked={props.diagram.snapManagerConfig.enabled}
            onChange={() => {
              props.diagram.snapManagerConfig.enabled = !props.diagram.snapManagerConfig.enabled;
            }}
            onClick={e => {
              const enabled = props.diagram.snapManagerConfig.enabled;
              if (enabled || ref.current?.dataset['state'] === 'open') {
                e.stopPropagation();
              }
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
                value={props.diagram.snapManagerConfig.threshold}
                onChange={v => {
                  props.diagram.snapManagerConfig.threshold = v ?? 0;
                }}
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
