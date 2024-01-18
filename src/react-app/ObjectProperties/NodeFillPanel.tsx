import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { useNodeProperty } from './useProperty.ts';
import { TbAdjustmentsHorizontal, TbCheck, TbChevronDown, TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { assertFillType } from '../../model/diagramProps.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import * as Select from '@radix-ui/react-select';

export const NodeFillPanel = (props: Props) => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();

  const fill = useNodeProperty(diagram, 'fill.color', defaults.fill.color);
  const fillImage = useNodeProperty(diagram, 'fill.image', defaults.fill.color);
  const color2 = useNodeProperty(diagram, 'fill.color2', defaults.fill.color2);
  const type = useNodeProperty(diagram, 'fill.type', defaults.fill.type);
  const enabled = useNodeProperty(diagram, 'fill.enabled', defaults.fill.enabled);

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
          <Select.Root
            onValueChange={v => {
              assertFillType(v);
              type.set(v);
            }}
            value={type.val}
          >
            <Select.Trigger className="cmp-select-trigger">
              <Select.Value placeholder={''} />
              <Select.Icon className="cmp-select-trigger__icon">
                <TbChevronDown />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="cmp-select-content">
                <Select.Viewport className="cmp-select-content__viewpoint">
                  <Select.Group>
                    <Select.Item className={'cmp-select-content__item'} value={'solid'}>
                      <Select.ItemText>Solid</Select.ItemText>
                      <Select.ItemIndicator className="cmp-select-content__item-indicator">
                        <TbCheck />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item className={'cmp-select-content__item'} value={'gradient'}>
                      <Select.ItemText>Gradient</Select.ItemText>
                      <Select.ItemIndicator className="cmp-select-content__item-indicator">
                        <TbCheck />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item className={'cmp-select-content__item'} value={'pattern'}>
                      <Select.ItemText>Pattern</Select.ItemText>
                      <Select.ItemIndicator className="cmp-select-content__item-indicator">
                        <TbCheck />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item className={'cmp-select-content__item'} value={'texture'}>
                      <Select.ItemText>Texture</Select.ItemText>
                      <Select.ItemIndicator className="cmp-select-content__item-indicator">
                        <TbCheck />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item className={'cmp-select-content__item'} value={'image'}>
                      <Select.ItemText>Image</Select.ItemText>
                      <Select.ItemIndicator className="cmp-select-content__item-indicator">
                        <TbCheck />
                      </Select.ItemIndicator>
                    </Select.Item>
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {(type.val === 'gradient' || type.val === 'solid') && (
          <>
            <div className={'cmp-labeled-table__label'}>Color:</div>
            <div className={'cmp-labeled-table__value'}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ColorPicker
                  primaryColors={primaryColors}
                  additionalHues={additionalHues}
                  color={fill.val}
                  onClick={fill.set}
                  hasMultipleValues={fill.hasMultipleValues}
                />
                {type.val === 'gradient' && (
                  <>
                    &nbsp;
                    <ColorPicker
                      primaryColors={primaryColors}
                      additionalHues={additionalHues}
                      color={color2.val}
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
          </>
        )}

        {type.val === 'image' && (
          <>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Image:</div>
            <div className={'cmp-labeled-table__value'}>
              <div style={{ display: 'flex', alignItems: 'top' }}>
                <label
                  className={'cmp-button'}
                  style={{ fontSize: '11px', justifyContent: 'left' }}
                  htmlFor={'fill-file-upload'}
                >
                  Upload...
                </label>
                <input
                  id={'fill-file-upload'}
                  style={{ display: 'none', width: 0 }}
                  type="file"
                  onChange={async e => {
                    console.log(e.target.files![0]);

                    // TODO: Should add a spinner...

                    const att = await diagram.document.attachments.addAttachment(
                      e.target.files![0]
                    );

                    const img = await createImageBitmap(att.content);
                    console.log(img.width, img.height);
                    img.close();

                    fillImage.set(att.url);
                    console.log(att.url);
                  }}
                />
              </div>
              <div>
                <img src={fillImage.val} width={80} height={80} />
              </div>
            </div>
            <div className={'cmp-labeled-table__label util-a-top'}>Settings:</div>
            <div className={'cmp-labeled-table__value'}>
              <div>Tile | Cover | None</div>
            </div>
          </>
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
