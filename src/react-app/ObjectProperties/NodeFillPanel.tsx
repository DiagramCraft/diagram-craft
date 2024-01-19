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
import { round } from '../../utils/math.ts';
import { SliderAndNumberInput } from '../SliderAndNumberInput.tsx';

const TEXTURES = [
  'bubbles1.jpeg',
  'grunge1.jpeg',
  'grunge2.jpeg',
  'grunge3.jpeg',
  'marble1.jpeg',
  'marble2.jpeg',
  'paper1.jpeg',
  'paper2.jpeg',
  'paper3.jpeg',
  'paper4.jpeg',
  'paper5.jpeg',
  'textile1.jpeg'
];

const ImageScale = (props: {
  fillImageScale: number;
  onChange: (v: number | undefined) => void;
}) => (
  <>
    <div className={'cmp-labeled-table__label'}>Scale:</div>
    <div className={'cmp-labeled-table__value'}>
      <SliderAndNumberInput value={round(props.fillImageScale * 100)} onChange={props.onChange} />
    </div>
  </>
);

export const NodeFillPanel = (props: Props) => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();

  const fill = useNodeProperty(diagram, 'fill.color', defaults.fill.color);
  const fillImage = useNodeProperty(diagram, 'fill.image.url', '');
  const fillImageFit = useNodeProperty(diagram, 'fill.image.fit', defaults.fill.image.fit);
  const fillImageW = useNodeProperty(diagram, 'fill.image.w', defaults.fill.image.w);
  const fillImageH = useNodeProperty(diagram, 'fill.image.h', defaults.fill.image.h);
  const fillImageScale = useNodeProperty(diagram, 'fill.image.scale', defaults.fill.image.scale);
  const fillImageTint = useNodeProperty(diagram, 'fill.image.tint', defaults.fill.image.tint);
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

        {type.val === 'texture' && (
          <>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Texture:</div>
            <div className={'cmp-labeled-table__value'}>
              {TEXTURES.map(t => (
                <img
                  key={t}
                  src={`/textures/${t}`}
                  style={{ width: 50, height: 50, marginRight: '0.25rem' }}
                  onClick={async () => {
                    const response = await fetch(`/textures/${t}`);
                    const blob = await response.blob();
                    const att = await diagram.document.attachments.addAttachment(blob);

                    const img = await createImageBitmap(att.content);
                    const { width, height } = img;
                    img.close();

                    diagram.undoManager.combine(() => {
                      fillImage.set(`/textures/${t}`);
                      fillImageFit.set('tile');
                      fillImageW.set(width);
                      fillImageH.set(height);
                    });
                  }}
                />
              ))}
            </div>

            <ImageScale
              fillImageScale={fillImageScale.val}
              onChange={v => {
                fillImageScale.set(Number(v) / 100);
              }}
            />
            <div className={'cmp-labeled-table__label util-a-top-center'}>Tint:</div>
            <div className={'cmp-labeled-table__value'}>
              <ColorPicker
                primaryColors={primaryColors}
                additionalHues={additionalHues}
                color={fillImageTint.val}
                onClick={fillImageTint.set}
                hasMultipleValues={fillImageTint.hasMultipleValues}
              />
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
                &nbsp;
                <button
                  className={'cmp-button'}
                  style={{ fontSize: '11px' }}
                  disabled={fillImage.val === ''}
                  onClick={() => {
                    diagram.undoManager.combine(() => {
                      fillImage.set('');
                      fillImageW.set(0);
                      fillImageH.set(0);
                    });
                    (document.getElementById('fill-file-upload') as HTMLInputElement).value = '';
                  }}
                >
                  Clear
                </button>
                <input
                  id={'fill-file-upload'}
                  style={{ display: 'none', width: 0 }}
                  type="file"
                  onChange={async e => {
                    // TODO: Should add a spinner...

                    const att = await diagram.document.attachments.addAttachment(
                      e.target.files![0]
                    );

                    const img = await createImageBitmap(att.content);
                    const { width, height } = img;
                    img.close();

                    diagram.undoManager.combine(() => {
                      fillImage.set(att.url);
                      fillImageW.set(width);
                      fillImageH.set(height);
                      fillImageTint.set('');
                    });
                  }}
                />
              </div>
              <div>
                {fillImage.val !== '' && fillImage.val !== undefined && (
                  <img
                    src={fillImage.val}
                    style={{ marginTop: '0.5rem', maxWidth: 80, maxHeight: 80 }}
                  />
                )}
              </div>
            </div>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Fit:</div>
            <div className={'cmp-labeled-table__value'}>
              <Select.Root
                onValueChange={v => {
                  // eslint-disable-next-line
                  fillImageFit.set(v as any);
                }}
                value={fillImageFit.val}
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
                        <Select.Item className={'cmp-select-content__item'} value={'fill'}>
                          <Select.ItemText>Fill</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'contain'}>
                          <Select.ItemText>Contain</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'cover'}>
                          <Select.ItemText>Cover</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'keep'}>
                          <Select.ItemText>Keep</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'tile'}>
                          <Select.ItemText>Tile</Select.ItemText>
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

            {fillImageFit.val === 'tile' && (
              <ImageScale
                fillImageScale={fillImageScale.val}
                onChange={v => {
                  fillImageScale.set(Number(v) / 100);
                }}
              />
            )}
          </>
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
