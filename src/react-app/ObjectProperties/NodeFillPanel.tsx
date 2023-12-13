import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { useNodeProperty } from './useProperty.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbAdjustmentsHorizontal, TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { assertFillType } from '../../model-viewer/diagramProps.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

export const NodeFillPanel = (props: Props) => {
  const diagram = useDiagram();
  const fill = useNodeProperty(diagram, 'fill.color', 'transparent');
  const color2 = useNodeProperty(diagram, 'fill.color2', 'transparent');
  const type = useNodeProperty(diagram, 'fill.type', 'solid');
  const enabled = useNodeProperty(diagram, 'fill.enabled', true);

  const [open, setOpen] = useState(false);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="fill"
      title={'Fill'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={type.val}
              onValueChange={v => {
                assertFillType(v);
                type.set(v);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'solid'}>
                Solid
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'gradient'}>
                Gradient
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'pattern'}>
                Pattern
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={fill.val ?? 'transparent'}
              onClick={fill.set}
              hasMultipleValues={fill.hasMultipleValues}
            />
            {type.val === 'gradient' && (
              <>
                &nbsp;
                <ColorPicker
                  primaryColors={primaryColors}
                  additionalHues={additionalHues}
                  color={color2.val ?? 'transparent'}
                  onClick={color2.set}
                  hasMultipleValues={color2.hasMultipleValues}
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
                        <h2>Gradient</h2>

                        <Popover.Close className="cmp-popover__close" aria-label="Close">
                          <TbX />
                        </Popover.Close>
                        <Popover.Arrow className="cmp-popover__arrow" />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
