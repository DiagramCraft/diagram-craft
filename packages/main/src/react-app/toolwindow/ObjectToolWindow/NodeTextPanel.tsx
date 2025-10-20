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
import { ColorPicker, ColorPreview } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { HAlign, VAlign } from '@diagram-craft/model/diagramProps';
import { round } from '@diagram-craft/utils/math';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Diagram } from '@diagram-craft/model/diagram';
import { MultiProperty } from './types';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import type { Property } from '@diagram-craft/model/property';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  fontSize: Property<number>;
  font: Property<string>;
  isBold: Property<boolean>;
  isItalic: Property<boolean>;
  textDecoration: Property<'none' | 'underline' | 'line-through' | 'overline'>;
  textTransform: Property<'none' | 'uppercase' | 'lowercase' | 'capitalize'>;
  color: Property<string>;
  top: Property<number>;
  left: Property<number>;
  bottom: Property<number>;
  right: Property<number>;
  align: Property<HAlign>;
  valign: Property<VAlign>;
  lineHeight: Property<number>;
};

class FormatProperty extends MultiProperty<string[]> {
  constructor(
    private readonly isBold: Property<boolean>,
    private readonly isItalic: Property<boolean>,
    private readonly textDecoration: Property<'none' | 'underline' | 'line-through' | 'overline'>
  ) {
    super([isBold, isItalic, textDecoration]);
  }

  formatAsString(val: unknown[]): string {
    const s: string[] = [];
    if (val[0]) s.push('Bold');
    if (val[0] === false) s.push('Regular');

    if (val[1]) s.push('Italic');
    if (val[1] === false) s.push('Normal');

    if (val[2] === 'underline') s.push('Underline');
    if (val[2] === 'line-through') s.push('Strikethrough');
    if (val[2] === 'overline') s.push('Overline');

    return s.join(', ');
  }

  get val() {
    const d: string[] = [];
    if (this.isBold.val) d.push('bold');
    if (this.isItalic.val) d.push('italic');
    if (this.textDecoration.val === 'underline') d.push('underline');
    if (this.textDecoration.val === 'line-through') d.push('strikethrough');
    return d;
  }

  set(value: string[] | undefined) {
    if (value === undefined) {
      this.isBold.set(undefined);
      this.isItalic.set(undefined);
      this.textDecoration.set(undefined);
    } else {
      if (this.isBold.val !== value.includes('bold')) this.isBold.set(value.includes('bold'));
      if (this.isItalic.val !== value.includes('italic'))
        this.isItalic.set(value.includes('italic'));

      const isUnderlineChanged =
        value.includes('underline') !== (this.textDecoration.val === 'underline');
      const isStrikethroughChanged =
        value.includes('strikethrough') !== (this.textDecoration.val === 'line-through');

      if (isUnderlineChanged) {
        this.textDecoration.set(value.includes('underline') ? 'underline' : undefined);
      } else if (isStrikethroughChanged) {
        this.textDecoration.set(value.includes('strikethrough') ? 'line-through' : undefined);
      }
    }
  }
}

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

  const format = new FormatProperty(isBold, isItalic, textDecoration);

  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Font:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={fontSize}
          render={props => (
            <NumberInput {...props} defaultUnit={'pt'} min={1} style={{ width: '45px' }} />
          )}
        />
        <PropertyEditor
          property={font}
          render={props => (
            <Select.Root {...props}>
              {Object.entries(fonts).map(([label, value]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Root>
          )}
        />
      </div>

      <div></div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={format}
          render={props => (
            <ToggleButtonGroup.Root {...props} aria-label="Formatting options" type={'multiple'}>
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
          )}
        />

        <PropertyEditor
          property={textTransform as Property<string>}
          render={props => (
            <ToggleButtonGroup.Root {...props} aria-label="Formatting options" type={'single'}>
              <ToggleButtonGroup.Item value={'capitalize'}>
                <TbLetterCase />
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'uppercase'}>
                <TbLetterCaseUpper />
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          )}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={color}
          render={props => (
            <ColorPicker
              {...props}
              palette={$cfg.palette.primary}
              customPalette={$d.document.customPalette}
              onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
            />
          )}
          renderValue={props => <ColorPreview {...props} />}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Align:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={align as Property<string>}
          render={props => (
            <ToggleButtonGroup.Root {...props} aria-label="Formatting options" type={'single'}>
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
          )}
        />

        <PropertyEditor
          property={valign as Property<string>}
          render={props => (
            <ToggleButtonGroup.Root {...props} aria-label="Formatting options" type={'single'}>
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
          )}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Line height:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={lineHeight}
          formatValue={v => round(v * 100)}
          storeValue={v => v / 100}
          render={props => (
            <NumberInput {...props} defaultUnit={'%'} min={0} style={{ width: '45px' }} />
          )}
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
            maxWidth: '10rem',
            gap: '0.2rem',
            gridTemplateAreas: '"gap1 top gap2" "left bottom right"',
            gridTemplateRows: 'repeat(2, 1fr)',
            gridTemplateColumns: 'repeat(3, 1fr)'
          }}
        >
          <div style={{ gridArea: 'gap1' }}></div>
          <div style={{ gridArea: 'gap2' }}></div>
          <PropertyEditor
            property={top}
            render={props => (
              <NumberInput
                {...props}
                defaultUnit={'px'}
                min={0}
                style={{ gridArea: 'top', width: '100%' }}
              />
            )}
          />
          <PropertyEditor
            property={left}
            render={props => (
              <NumberInput
                {...props}
                defaultUnit={'px'}
                min={0}
                style={{ gridArea: 'left', width: '100%' }}
              />
            )}
          />
          <PropertyEditor
            property={bottom}
            render={props => (
              <NumberInput
                {...props}
                defaultUnit={'px'}
                min={0}
                style={{ gridArea: 'bottom', width: '100%' }}
              />
            )}
          />
          <PropertyEditor
            property={right}
            render={props => (
              <NumberInput
                {...props}
                defaultUnit={'px'}
                min={0}
                style={{ gridArea: 'right', width: '100%' }}
              />
            )}
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
