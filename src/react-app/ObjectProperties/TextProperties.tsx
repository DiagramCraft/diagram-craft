import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useNodeProperty.ts';
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
  // TODO: Should be useElementProperty
  const [font, setFont] = useNodeProperty('text.font', props.diagram, 'Arial');
  const [fontSize, setFontSize] = useNodeProperty('text.fontSize', props.diagram, '10');
  const [isBold, setIsBold] = useNodeProperty('text.bold', props.diagram, false);
  const [isItalic, setIsItalic] = useNodeProperty('text.italic', props.diagram, false);
  const [textDecoration, setTextDecoration] = useNodeProperty<
    NonNullable<NodeProps['text']>['textDecoration']
  >('text.textDecoration', props.diagram, undefined);
  const [textTransform, setTextTransform] = useNodeProperty<
    NonNullable<NodeProps['text']>['textTransform']
  >('text.textTransform', props.diagram, undefined);
  const [color, setColor] = useNodeProperty<string>('text.color', props.diagram, undefined);
  const [align, setAlign] = useNodeProperty<string>('text.align', props.diagram, 'center');
  const [valign, setVAlign] = useNodeProperty<string>('text.valign', props.diagram, 'middle');
  const [top, setTop] = useNodeProperty<string>('text.top', props.diagram, '0');
  const [left, setLeft] = useNodeProperty<string>('text.left', props.diagram, '0');
  const [bottom, setBottom] = useNodeProperty<string>('text.bottom', props.diagram, '0');
  const [right, setRight] = useNodeProperty<string>('text.right', props.diagram, '0');

  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Font:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type={'number'}
            value={fontSize ?? 10}
            min={1}
            style={{ width: '45px' }}
            onChange={ev => {
              setFontSize(ev.target.value);
            }}
          />
          &nbsp;
          <Select.Root value={font} onValueChange={setFont}>
            <Select.Trigger className="cmp-select-trigger">
              <Select.Value placeholder={font} />
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
                bold: isBold,
                italic: isItalic,
                underline: textDecoration === 'underline',
                strikethrough: textDecoration === 'line-through'
              })
                .filter(([_, value]) => value)
                .map(([key, _]) => key)}
              onValueChange={value => {
                setIsBold(value.includes('bold'));
                setIsItalic(value.includes('italic'));

                const isUnderlineChanged =
                  value.includes('underline') !== (textDecoration === 'underline');
                const isStrikethroughChanged =
                  value.includes('strikethrough') !== (textDecoration === 'line-through');

                if (isUnderlineChanged) {
                  setTextDecoration(value.includes('underline') ? 'underline' : undefined);
                } else if (isStrikethroughChanged) {
                  setTextDecoration(value.includes('strikethrough') ? 'line-through' : undefined);
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
              value={textTransform}
              onValueChange={value => {
                setTextTransform(
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
          color={color ?? 'transparent'}
          onClick={setColor}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Align:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup type={'single'} value={align} onValueChange={setAlign}>
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
            <ReactToolbar.ToggleGroup type={'single'} value={valign} onValueChange={setVAlign}>
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
          <input
            type={'number'}
            value={top}
            min={0}
            style={{ gridArea: 'top', width: '100%' }}
            onChange={ev => {
              setTop(ev.target.value);
            }}
          />
          <input
            type={'number'}
            value={left}
            min={0}
            style={{ gridArea: 'left', width: '100%' }}
            onChange={ev => {
              setLeft(ev.target.value);
            }}
          />
          <input
            type={'number'}
            value={bottom}
            min={0}
            style={{ gridArea: 'bottom', width: '100%' }}
            onChange={ev => {
              setBottom(ev.target.value);
            }}
          />
          <input
            type={'number'}
            value={right}
            min={0}
            style={{ gridArea: 'right', width: '100%' }}
            onChange={ev => {
              setRight(ev.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
