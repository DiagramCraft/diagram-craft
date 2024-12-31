import { useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useDiagram } from '../../../application';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from '../ObjectToolWindow/types';

type IndicatorFormProps = {
  shape: Property<string>;
  color: Property<string>;
  width: Property<number>;
  height: Property<number>;
  position: Property<'n' | 's' | 'w' | 'e' | 'c' | 'ne' | 'nw' | 'se' | 'sw'>;
  direction: Property<'n' | 's' | 'e' | 'w'>;
  offset: Property<number>;
};

export const IndicatorForm = (props: IndicatorFormProps) => {
  const diagram = useDiagram();

  const $cfg = useConfiguration();
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Type:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <PropertyEditor
          property={props.shape}
          render={props => (
            <Select.Root {...props}>
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
      </div>

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <PropertyEditor
          property={props.color}
          render={props => (
            <ColorPicker
              {...props}
              palette={$cfg.palette.primary}
              customPalette={diagram.document.customPalette.colors}
              onChangeCustomPalette={(idx, v) => diagram.document.customPalette.setColor(idx, v)}
            />
          )}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Size:</div>
      <div
        className={'cmp-labeled-table__value util-vcenter'}
        style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
      >
        <PropertyEditor
          property={props.width}
          render={props => <NumberInput {...props} label={'w'} />}
        />

        <PropertyEditor
          property={props.height}
          render={props => <NumberInput {...props} label={'h'} />}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Position:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <PropertyEditor
          property={props.position as Property<string>}
          render={props => (
            <Select.Root {...props}>
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
      </div>

      <div className={'cmp-labeled-table__label'}></div>
      <div
        className={'cmp-labeled-table__value util-vcenter'}
        style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
      >
        <PropertyEditor
          property={props.offset}
          render={props => <NumberInput {...props} label="Δ" />}
        />

        <PropertyEditor
          property={props.direction as Property<string>}
          render={props => (
            <Select.Root {...props}>
              <Select.Item value={'e'}>East</Select.Item>
              <Select.Item value={'n'}>North</Select.Item>
              <Select.Item value={'w'}>West</Select.Item>
              <Select.Item value={'s'}>South</Select.Item>
            </Select.Root>
          )}
        />
      </div>
    </div>
  );
};
