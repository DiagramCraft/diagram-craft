import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useProperty.ts';
import * as Select from '@radix-ui/react-select';
import {
  TbAlignCenter,
  TbAlignLeft,
  TbAlignRight,
  TbBold,
  TbCheck,
  TbChevronDown,
  TbItalic,
  TbLetterCase,
  TbLetterCaseUpper,
  TbStrikethrough,
  TbUnderline
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { RxTextAlignBottom, RxTextAlignMiddle, RxTextAlignTop } from 'react-icons/rx';
import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { NumberInput } from '../NumberInput.tsx';
import { assertHAlign, assertVAlign } from '../../model-viewer/diagramProps.ts';

const FONTS = {
  Times: 'Times',
  Arial: 'Arial',
  Helvetica: 'Helvetica',
  Verdana: 'Verdana',
  Courier: 'Courier',
  'Comic Sans': 'Comic Sans MS',
  Impact: 'Impact',
  Tahoma: 'Tahoma',
  Trebuchet: 'Trebuchet MS',
  Georgia: 'Georgia'
};

export const TextProperties = (props: Props) => {
  const $d = props.diagram;

  // TODO: Should be useElementProperty
  const font = useNodeProperty($d, 'text.font', 'Arial');
  const fontSize = useNodeProperty($d, 'text.fontSize', 10);
  const isBold = useNodeProperty($d, 'text.bold', false);
  const isItalic = useNodeProperty($d, 'text.italic', false);
  const textDecoration = useNodeProperty($d, 'text.textDecoration', undefined);
  const textTransform = useNodeProperty($d, 'text.textTransform', undefined);
  const color = useNodeProperty($d, 'text.color', undefined);
  const align = useNodeProperty($d, 'text.align', 'center');
  const valign = useNodeProperty($d, 'text.valign', 'middle');
  const top = useNodeProperty($d, 'text.top', 0);
  const left = useNodeProperty($d, 'text.left', 0);
  const bottom = useNodeProperty($d, 'text.bottom', 0);
  const right = useNodeProperty($d, 'text.right', 0);

  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Font:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NumberInput
            validUnits={['pt']}
            defaultUnit={'pt'}
            value={fontSize.val ?? 10}
            min={1}
            style={{ width: '45px' }}
            onChange={fontSize.set}
          />
          &nbsp;
          <Select.Root value={font.val} onValueChange={font.set}>
            <Select.Trigger className="cmp-select-trigger">
              <Select.Value placeholder={font.val} />
              <Select.Icon className="cmp-select-trigger__icon">
                <TbChevronDown />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="cmp-select-content">
                <Select.Viewport className="cmp-select-content__viewpoint">
                  <Select.Group>
                    {Object.entries(FONTS).map(([label, value]) => {
                      return (
                        <Select.Item
                          key={value}
                          className={'cmp-select-content__item'}
                          value={value}
                        >
                          <Select.ItemText>{label}</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                      );
                    })}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      <div></div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'multiple'}
              value={Object.entries({
                bold: isBold.val,
                italic: isItalic.val,
                underline: textDecoration.val === 'underline',
                strikethrough: textDecoration.val === 'line-through'
              })
                .filter(([_, value]) => value)
                .map(([key, _]) => key)}
              onValueChange={value => {
                isBold.set(value.includes('bold'));
                isItalic.set(value.includes('italic'));

                const isUnderlineChanged =
                  value.includes('underline') !== (textDecoration.val === 'underline');
                const isStrikethroughChanged =
                  value.includes('strikethrough') !== (textDecoration.val === 'line-through');

                if (isUnderlineChanged) {
                  textDecoration.set(value.includes('underline') ? 'underline' : undefined);
                } else if (isStrikethroughChanged) {
                  textDecoration.set(value.includes('strikethrough') ? 'line-through' : undefined);
                }
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bold'}>
                <TbBold />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'italic'}>
                <TbItalic />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'underline'}>
                <TbUnderline />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'strikethrough'}>
                <TbStrikethrough />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
          &nbsp;
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={textTransform.val}
              onValueChange={value => {
                textTransform.set(
                  value as unknown as NonNullable<NodeProps['text']>['textTransform']
                );
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'capitalize'}>
                <TbLetterCase />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'uppercase'}>
                <TbLetterCaseUpper />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>
      </div>

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value'}>
        <ColorPicker
          primaryColors={primaryColors}
          additionalHues={additionalHues}
          color={color.val ?? 'transparent'}
          onClick={color.set}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Align:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={align.val}
              onValueChange={v => {
                assertHAlign(v);
                align.set(v);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'left'}>
                <TbAlignLeft />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'center'}>
                <TbAlignCenter />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'right'}>
                <TbAlignRight />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
          &nbsp;
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={valign.val}
              onValueChange={v => {
                assertVAlign(v);
                valign.set(v);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'top'}>
                <RxTextAlignTop />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'middle'}>
                <RxTextAlignMiddle />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bottom'}>
                <RxTextAlignBottom />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>
      </div>

      <div
        className={'cmp-labeled-table__label'}
        style={{ alignSelf: 'start', marginTop: '0.25rem' }}
      >
        Spacing:
      </div>
      <div className={'cmp-labeled-table__value'}>
        <div
          style={{
            display: 'grid',
            gap: '0.25rem',
            gridTemplateAreas: '"gap1 top gap2" "left bottom right"',
            gridTemplateRows: 'repeat(2, 1fr)',
            gridTemplateColumns: 'repeat(3, 1fr)'
          }}
        >
          <div style={{ gridArea: 'gap1' }}></div>
          <div style={{ gridArea: 'gap2' }}></div>
          <NumberInput
            validUnits={['px']}
            defaultUnit={'px'}
            value={top.val ?? ''}
            min={0}
            style={{ gridArea: 'top', width: '100%' }}
            onChange={top.set}
          />
          <NumberInput
            validUnits={['px']}
            defaultUnit={'px'}
            value={left.val ?? ''}
            min={0}
            style={{ gridArea: 'left', width: '100%' }}
            onChange={left.set}
          />
          <NumberInput
            validUnits={['px']}
            defaultUnit={'px'}
            value={bottom.val ?? ''}
            min={0}
            style={{ gridArea: 'bottom', width: '100%' }}
            onChange={bottom.set}
          />
          <NumberInput
            validUnits={['px']}
            defaultUnit={'px'}
            value={right.val ?? ''}
            min={0}
            style={{ gridArea: 'right', width: '100%' }}
            onChange={right.set}
          />
        </div>
      </div>
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
