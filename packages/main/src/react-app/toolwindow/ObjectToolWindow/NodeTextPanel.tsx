import { useNodeProperty } from '../../hooks/useProperty';
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
import { RxTextAlignBottom, RxTextAlignMiddle, RxTextAlignTop } from 'react-icons/rx';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../context/DiagramContext';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { assertHAlign, assertVAlign, HAlign, VAlign } from '@diagram-craft/model/diagramProps';
import { round } from '@diagram-craft/utils/math';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Diagram } from '@diagram-craft/model/diagram';
import { Property } from './types';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  fontSize: Property<number | undefined>;
  font: Property<string | undefined>;
  isBold: Property<boolean | undefined>;
  isItalic: Property<boolean | undefined>;
  textDecoration: Property<'none' | 'underline' | 'line-through' | 'overline' | undefined>;
  textTransform: Property<'none' | 'uppercase' | 'lowercase' | 'capitalize' | undefined>;
  color: Property<string | undefined>;
  top: Property<number | undefined>;
  left: Property<number | undefined>;
  bottom: Property<number | undefined>;
  right: Property<number | undefined>;
  align: Property<HAlign | undefined>;
  valign: Property<VAlign | undefined>;
  lineHeight: Property<number | undefined>;
};

export const NodeTextPanelForm = ({
  diagram: $d,
  config: $cfg,
  fontSize,
  font,
  isBold,
  isItalic,
  textDecoration,
  textTransform,
  color,
  top,
  left,
  bottom,
  right,
  align,
  valign,
  lineHeight
}: FormProps) => {
  const fonts = $cfg.fonts;
  return (
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
        <Select.Root
          value={font.val}
          hasMultipleValues={font.hasMultipleValues}
          onValueChange={font.set}
        >
          {Object.entries(fonts).map(([label, value]) => (
            <Select.Item key={value} value={value}>
              {label}
            </Select.Item>
          ))}
        </Select.Root>
      </div>

      <div></div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <ToggleButtonGroup.Root
          aria-label="Formatting options"
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
            if (!!isItalic.val !== value.includes('italic')) isItalic.set(value.includes('italic'));

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
          <ToggleButtonGroup.Item value={'bold'}>
            <TbBold />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'italic'}>
            <TbItalic />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'underline'}>
            <TbUnderline />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'strikethrough'}>
            <TbStrikethrough />
          </ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>

        <ToggleButtonGroup.Root
          aria-label="Formatting options"
          type={'single'}
          value={textTransform.val}
          onValueChange={(value: string) => {
            textTransform.set(value as NonNullable<NodeProps['text']>['textTransform']);
          }}
        >
          <ToggleButtonGroup.Item value={'capitalize'}>
            <TbLetterCase />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'uppercase'}>
            <TbLetterCaseUpper />
          </ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
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
        <ToggleButtonGroup.Root
          aria-label="Formatting options"
          type={'single'}
          value={align.val}
          onValueChange={v => {
            assertHAlign(v);
            align.set(v);
          }}
        >
          <ToggleButtonGroup.Item value={'left'}>
            <TbAlignLeft />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'center'}>
            <TbAlignCenter />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'right'}>
            <TbAlignRight />
          </ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
        <ToggleButtonGroup.Root
          aria-label="Formatting options"
          type={'single'}
          value={valign.val}
          onValueChange={v => {
            assertVAlign(v);
            valign.set(v);
          }}
        >
          <ToggleButtonGroup.Item value={'top'}>
            <RxTextAlignTop />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'middle'}>
            <RxTextAlignMiddle />
          </ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value={'bottom'}>
            <RxTextAlignBottom />
          </ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
      </div>

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
    </div>
  );
};

export const NodeTextPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const font = useNodeProperty($d, 'text.font');
  const fontSize = useNodeProperty($d, 'text.fontSize');
  const lineHeight = useNodeProperty($d, 'text.lineHeight');
  const isBold = useNodeProperty($d, 'text.bold');
  const isItalic = useNodeProperty($d, 'text.italic');
  const textDecoration = useNodeProperty($d, 'text.textDecoration');
  const textTransform = useNodeProperty($d, 'text.textTransform');
  const color = useNodeProperty($d, 'text.color');
  const align = useNodeProperty($d, 'text.align');
  const valign = useNodeProperty($d, 'text.valign');
  const top = useNodeProperty($d, 'text.top');
  const left = useNodeProperty($d, 'text.left');
  const bottom = useNodeProperty($d, 'text.bottom');
  const right = useNodeProperty($d, 'text.right');

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={'Text'} id={'text'}>
      <NodeTextPanelForm
        diagram={$d}
        config={$cfg}
        fontSize={fontSize}
        font={font}
        isBold={isBold}
        isItalic={isItalic}
        textDecoration={textDecoration}
        textTransform={textTransform}
        color={color}
        top={top}
        left={left}
        bottom={bottom}
        right={right}
        align={align}
        valign={valign}
        lineHeight={lineHeight}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
