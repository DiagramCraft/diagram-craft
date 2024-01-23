import { useElementProperty } from './useProperty.ts';
import {
  TbAlignCenter,
  TbAlignLeft,
  TbAlignRight,
  TbBold,
  TbItalic,
  TbLetterCase,
  TbLetterCaseUpper,
  TbStrikethrough,
  TbUnderline
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { RxTextAlignBottom, RxTextAlignMiddle, RxTextAlignTop } from 'react-icons/rx';
import { ColorPicker } from '../components/ColorPicker.tsx';
import { NumberInput } from '../components/NumberInput.tsx';
import { assertHAlign, assertVAlign } from '../../model/diagramProps.ts';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import { useConfiguration } from '../context/ConfigurationContext.tsx';
import { Collapsible } from '../components/Collapsible.tsx';
import { round } from '../../utils/math.ts';
import { Select } from '../components/Select.tsx';

export const TextPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const defaults = useNodeDefaults();
  const { fonts } = useConfiguration();

  const font = useElementProperty($d, 'text.font', defaults.text.font);
  const fontSize = useElementProperty($d, 'text.fontSize', defaults.text.fontSize);
  const lineHeight = useElementProperty($d, 'text.lineHeight', defaults.text.lineHeight);
  const isBold = useElementProperty($d, 'text.bold', defaults.text.bold);
  const isItalic = useElementProperty($d, 'text.italic', defaults.text.italic);
  const textDecoration = useElementProperty(
    $d,
    'text.textDecoration',
    defaults.text.textDecoration
  );
  const textTransform = useElementProperty($d, 'text.textTransform', defaults.text.textTransform);
  const color = useElementProperty($d, 'text.color', defaults.text.color);
  const align = useElementProperty($d, 'text.align', defaults.text.align);
  const valign = useElementProperty($d, 'text.valign', defaults.text.valign);
  const top = useElementProperty($d, 'text.top', defaults.text.top);
  const left = useElementProperty($d, 'text.left', defaults.text.left);
  const bottom = useElementProperty($d, 'text.bottom', defaults.text.bottom);
  const right = useElementProperty($d, 'text.right', defaults.text.right);

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={'Text'} id={'text'}>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Font:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <NumberInput
            defaultUnit={'pt'}
            value={fontSize.val}
            min={1}
            style={{ width: '45px' }}
            onChange={fontSize.set}
            hasMultipleValues={fontSize.hasMultipleValues}
          />
          {/* TODO: Can we use Select here - need to support hasMultipleValues */}
          <Select
            value={font.val}
            hasMultipleValues={font.hasMultipleValues}
            onValueChange={font.set}
            values={Object.entries(fonts).map(([label, value]) => ({
              value,
              label
            }))}
          />
        </div>

        <div></div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
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
                if (!!isBold.val !== value.includes('bold')) isBold.set(value.includes('bold'));
                if (!!isItalic.val !== value.includes('italic'))
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
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={textTransform.val}
              onValueChange={value => {
                textTransform.set(value as NonNullable<NodeProps['text']>['textTransform']);
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

        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={color.val}
            onChange={color.set}
            hasMultipleValues={color.hasMultipleValues}
            customPalette={$d.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Align:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
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
              gap: '0.2rem',
              gridTemplateAreas: '"gap1 top gap2" "left bottom right"',
              gridTemplateRows: 'repeat(2, 1fr)',
              gridTemplateColumns: 'repeat(3, 1fr)'
            }}
          >
            <div style={{ gridArea: 'gap1' }}></div>
            <div style={{ gridArea: 'gap2' }}></div>
            <NumberInput
              defaultUnit={'px'}
              value={top.val}
              min={0}
              style={{ gridArea: 'top', width: '100%' }}
              onChange={top.set}
              hasMultipleValues={top.hasMultipleValues}
            />
            <NumberInput
              defaultUnit={'px'}
              value={left.val}
              min={0}
              style={{ gridArea: 'left', width: '100%' }}
              onChange={left.set}
              hasMultipleValues={left.hasMultipleValues}
            />
            <NumberInput
              defaultUnit={'px'}
              value={bottom.val}
              min={0}
              style={{ gridArea: 'bottom', width: '100%' }}
              onChange={bottom.set}
              hasMultipleValues={bottom.hasMultipleValues}
            />
            <NumberInput
              defaultUnit={'px'}
              value={right.val}
              min={0}
              style={{ gridArea: 'right', width: '100%' }}
              onChange={right.set}
              hasMultipleValues={right.hasMultipleValues}
            />
          </div>
        </div>

        <Collapsible label={'Additional settings'}>
          <div className={'cmp-labeled-table'}>
            <div className={'cmp-labeled-table__label'}>Line height:</div>
            <div className={'cmp-labeled-table__value'}>
              <NumberInput
                defaultUnit={'%'}
                value={round(lineHeight.val * 100)}
                min={0}
                style={{ width: '45px' }}
                onChange={v => {
                  lineHeight.set(v ? v / 100 : 0);
                }}
                hasMultipleValues={lineHeight.hasMultipleValues}
              />
            </div>
          </div>
        </Collapsible>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
