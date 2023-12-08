import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { NumberInput } from '../NumberInput.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { useRef } from 'react';
import { ActionCheckbox } from '../components/ActionCheckbox.tsx';

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
          <div className={'cmp-labeled-table__label util-a-top'}>Snap:</div>
          <div className={'cmp-labeled-table__value util-vstack'}>
            <div className={'util-vcenter util-vgap util-font-body'}>
              <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_GRID'}>
                Snap to grid
              </ActionCheckbox>
            </div>
            <div className={'util-vcenter util-vgap util-font-body'}>
              <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_NODE'}>
                Snap to object bounds
              </ActionCheckbox>
            </div>
            <div className={'util-vcenter util-vgap util-font-body'}>
              <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_CANVAS'}>
                Snap to canvas midpoint
              </ActionCheckbox>
            </div>
            <div className={'util-vcenter util-vgap util-font-body'}>
              <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_DISTANCE'}>
                Snap to object size
              </ActionCheckbox>
            </div>
            <div className={'util-vcenter util-vgap util-font-body'}>
              <ActionCheckbox actionMap={props.actionMap} action={'TOGGLE_MAGNET_TYPE_SIZE'}>
                Snap to object distance
              </ActionCheckbox>
            </div>
          </div>

          <div className={'cmp-labeled-table__label'}>Threshold:</div>
          <div className={'cmp-labeled-table__value'}>
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
      </AccordionContent>
    </Accordion.Item>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
