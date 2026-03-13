import { useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useDiagram } from '../../../application';
import { PropertyEditor } from '../../components/PropertyEditor';
import type { Property } from '@diagram-craft/model/property';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

type IndicatorFormProps = {
  shape: Property<string>;
  color: Property<string>;
  width: Property<number>;
  height: Property<number>;
  position: Property<'n' | 's' | 'w' | 'e' | 'c' | 'ne' | 'nw' | 'se' | 'sw'>;
  direction: Property<'n' | 's' | 'e' | 'w'>;
  offset: Property<number>;
  isReadOnly?: boolean;
};

export const IndicatorForm = (props: IndicatorFormProps) => {
  const $p = props;
  const diagram = useDiagram();

  const $cfg = useConfiguration();
  return (
    <KeyValueTable.Root>
      <KeyValueTable.Label>Type:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor
          property={props.shape}
          render={props => (
            <Select.Root {...props} disabled={$p.isReadOnly}>
              <Select.Item value={'disc'}>Disc</Select.Item>
              <Select.Item value={'triangle'}>Triangle</Select.Item>
              <Select.Item value={'star'}>Star</Select.Item>
              <Select.Item value={'actor'}>Actor</Select.Item>
              <Select.Item value={'lock'}>Lock</Select.Item>
              <Select.Item value={'comment'}>Comment</Select.Item>
              <Select.Item value={'note'}>Note</Select.Item>
            </Select.Root>
          )}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Color:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor
          property={props.color}
          render={props => (
            <ColorPicker
              {...props}
              disabled={$p.isReadOnly}
              palette={$cfg.palette.primary}
              customPalette={diagram.document.customPalette}
              onChangeCustomPalette={(idx, v) => diagram.document.customPalette.setColor(idx, v)}
            />
          )}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Size:</KeyValueTable.Label>
      <KeyValueTable.Value
        style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
      >
        <PropertyEditor
          property={props.width}
          render={props => <NumberInput {...props} disabled={$p.isReadOnly} label={'w'} />}
        />

        <PropertyEditor
          property={props.height}
          render={props => <NumberInput {...props} disabled={$p.isReadOnly} label={'h'} />}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label valign={'top'}>Position:</KeyValueTable.Label>
      <KeyValueTable.Value stack={'vertical'}>
        <PropertyEditor
          property={props.position as Property<string>}
          render={props => (
            <Select.Root {...props} disabled={$p.isReadOnly}>
              <Select.Item value={'e'}>East</Select.Item>
              <Select.Item value={'ne'}>North East</Select.Item>
              <Select.Item value={'n'}>North</Select.Item>
              <Select.Item value={'nw'}>North West</Select.Item>
              <Select.Item value={'w'}>West</Select.Item>
              <Select.Item value={'sw'}>South West</Select.Item>
              <Select.Item value={'s'}>South</Select.Item>
              <Select.Item value={'se'}>South East</Select.Item>
              <Select.Item value={'c'}>Center</Select.Item>
            </Select.Root>
          )}
        />
        <PropertyEditor
          property={props.offset}
          render={props => <NumberInput {...props} disabled={$p.isReadOnly} label="Δ" />}
        />
        <PropertyEditor
          property={props.direction as Property<string>}
          render={props => (
            <Select.Root {...props} disabled={$p.isReadOnly}>
              <Select.Item value={'e'}>East</Select.Item>
              <Select.Item value={'n'}>North</Select.Item>
              <Select.Item value={'w'}>West</Select.Item>
              <Select.Item value={'s'}>South</Select.Item>
            </Select.Root>
          )}
        />
      </KeyValueTable.Value>
    </KeyValueTable.Root>
  );
};
