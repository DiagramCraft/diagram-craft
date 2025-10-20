import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import {
  TbAdjustmentsHorizontal,
  TbBorderHorizontal,
  TbBorderOuter,
  TbBorderVertical
} from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { PopoverButton } from '../../components/PopoverButton';
import { useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { useTableProperty } from '../../hooks/useTable';
import { DashSelector } from './components/DashSelector';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { PropertyEditor } from '../../components/PropertyEditor';
import { MultiProperty } from './types';
import { useDiagram } from '../../../application';
import type { Property } from '@diagram-craft/model/property';

class StrokeProperty extends MultiProperty<string[]> {
  constructor(
    private readonly outerBorder: Property<boolean>,
    private readonly horizontalBorder: Property<boolean>,
    private readonly vertical: Property<boolean>
  ) {
    super([outerBorder, horizontalBorder, vertical]);
  }

  formatAsString(val: unknown[]): string {
    const s: string[] = [];

    if (val[0]) s.push('Outer');
    if (val[0] === false) s.push('No outer');

    if (val[1]) s.push('Horizontal');
    if (val[1] === false) s.push('No horizontal');

    if (val[2]) s.push('Vertical');
    if (val[2] === false) s.push('No vertical');

    return s.join(', ');
  }

  get val() {
    const d: string[] = [];
    if (this.outerBorder.val) d.push('outer');
    if (this.horizontalBorder.val) d.push('horizontal');
    if (this.vertical.val) d.push('vertical');
    return d;
  }

  set(val: string[] | undefined) {
    if (val === undefined) {
      this.outerBorder.set(undefined);
      this.horizontalBorder.set(undefined);
      this.vertical.set(undefined);
    } else {
      this.outerBorder.set(val.includes('outer'));
      this.horizontalBorder.set(val.includes('horizontal'));
      this.vertical.set(val.includes('vertical'));
    }
  }
}

export const NodeTableStrokePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const strokeColor = useTableProperty($d, 'stroke.color');
  const pattern = useTableProperty($d, 'stroke.pattern');

  const strokeSize = useTableProperty($d, 'stroke.patternSize');
  const strokeSpacing = useTableProperty($d, 'stroke.patternSpacing');
  const strokeWidth = useTableProperty($d, 'stroke.width');
  const enabled = useTableProperty($d, 'stroke.enabled');

  const lineCap = useTableProperty($d, 'stroke.lineCap');
  const lineJoin = useTableProperty($d, 'stroke.lineJoin');
  const miterLimit = useTableProperty($d, 'stroke.miterLimit');

  const horizontalBorder = useTableProperty($d, 'custom.table.horizontalBorder');
  const verticalBorder = useTableProperty($d, 'custom.table.verticalBorder');

  const outerBorder = useTableProperty($d, 'custom.table.outerBorder');

  const stroke = new StrokeProperty(outerBorder, horizontalBorder, verticalBorder);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stroke"
      title={'Stroke'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Border:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <PropertyEditor
            property={stroke}
            render={props => (
              <ToggleButtonGroup.Root {...props} type={'multiple'}>
                <ToggleButtonGroup.Item value={'outer'}>
                  <TbBorderOuter />
                </ToggleButtonGroup.Item>
                <ToggleButtonGroup.Item value={'horizontal'}>
                  <TbBorderHorizontal />
                </ToggleButtonGroup.Item>
                <ToggleButtonGroup.Item value={'vertical'}>
                  <TbBorderVertical />
                </ToggleButtonGroup.Item>
              </ToggleButtonGroup.Root>
            )}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor
            property={strokeColor}
            render={props => (
              <ColorPicker
                {...props}
                palette={$cfg.palette.primary}
                customPalette={$d.document.customPalette}
                onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
              />
            )}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <PropertyEditor
            property={strokeWidth}
            render={props => (
              <NumberInput {...props} defaultUnit={'px'} min={1} style={{ width: '35px' }} />
            )}
          />
          <DashSelector property={pattern} />
          <PopoverButton label={<TbAdjustmentsHorizontal />}>
            <div className={'cmp-labeled-table'}>
              <div className={'cmp-labeled-table__label'}>Stroke:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={strokeSize}
                  render={props => (
                    <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
                  )}
                />
                <PropertyEditor
                  property={strokeSpacing}
                  render={props => (
                    <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
                  )}
                />
              </div>

              <div className={'cmp-labeled-table__label'}>Line cap:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={lineCap as Property<string>}
                  render={props => (
                    <Select.Root {...props}>
                      <Select.Item value={'butt'}>Butt</Select.Item>
                      <Select.Item value={'round'}>Round</Select.Item>
                      <Select.Item value={'square'}>Square</Select.Item>
                    </Select.Root>
                  )}
                />
              </div>
              <div className={'cmp-labeled-table__label'}>Line join:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={lineJoin as Property<string>}
                  render={props => (
                    <Select.Root {...props}>
                      <Select.Item value={'miter'}>Miter</Select.Item>
                      <Select.Item value={'round'}>Round</Select.Item>
                      <Select.Item value={'bevel'}>Bevel</Select.Item>
                    </Select.Root>
                  )}
                />

                {lineJoin.val === 'miter' && (
                  <PropertyEditor
                    property={miterLimit}
                    formatValue={v => v * 10}
                    storeValue={v => v / 10}
                    render={props => <NumberInput {...props} min={0} style={{ width: '50px' }} />}
                  />
                )}
              </div>
            </div>
          </PopoverButton>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
