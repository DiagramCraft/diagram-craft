import { Indicator } from '@diagram-craft/model/diagramProps';
import { useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { Direction } from '@diagram-craft/geometry/direction';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useDiagram } from '../../../application';

type IndicatorFormProps = {
  indicator: Indicator;
  update: <K extends keyof Indicator>(key: K, value: Indicator[K]) => void;
};

export const IndicatorForm = (props: IndicatorFormProps) => {
  const diagram = useDiagram();
  const indicator = props.indicator;
  const update = props.update;

  const $cfg = useConfiguration();
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Type:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <Select.Root
          value={indicator?.shape ?? 'disc'}
          onChange={v => update('shape', v ?? 'disc')}
          style={{ width: '90%' }}
        >
          <Select.Item value={'disc'}>Disc</Select.Item>
          <Select.Item value={'triangle'}>Triangle</Select.Item>
          <Select.Item value={'star'}>Star</Select.Item>
          <Select.Item value={'actor'}>Actor</Select.Item>
          <Select.Item value={'lock'}>Lock</Select.Item>
          <Select.Item value={'comment'}>Comment</Select.Item>
          <Select.Item value={'note'}>Note</Select.Item>
        </Select.Root>
      </div>

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <ColorPicker
          palette={$cfg.palette.primary}
          value={indicator?.color ?? 'red'}
          onChange={v => update('color', v)}
          customPalette={diagram.document.customPalette.colors}
          onChangeCustomPalette={(idx, v) => diagram.document.customPalette.setColor(idx, v)}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Size:</div>
      <div
        className={'cmp-labeled-table__value util-vcenter'}
        style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
      >
        <NumberInput
          value={indicator?.width ?? 10}
          label={'w'}
          onChange={v => update('width', Number(v))}
        />
        <NumberInput
          value={indicator?.height ?? 10}
          label={'h'}
          onChange={v => update('height', Number(v))}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Position:</div>
      <div className={'cmp-labeled-table__value util-vcenter'}>
        <Select.Root
          value={indicator?.position ?? 'e'}
          onChange={v => update('position', (v ?? 'e') as any)}
          style={{ width: '90%' }}
        >
          <Select.Item value={'e'}>East</Select.Item>
          <Select.Item value={'ne'}>North East</Select.Item>
          <Select.Item value={'n'}>North</Select.Item>
          <Select.Item value={'nw'}>North West</Select.Item>
          <Select.Item value={'w'}>West</Select.Item>
          <Select.Item value={'sw'}>South West</Select.Item>
          <Select.Item value={'s'}>Sout</Select.Item>
          <Select.Item value={'se'}>Sout East</Select.Item>
        </Select.Root>
      </div>

      <div className={'cmp-labeled-table__label'}></div>
      <div
        className={'cmp-labeled-table__value util-vcenter'}
        style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
      >
        <NumberInput
          label="Δ"
          value={indicator?.offset ?? 10}
          onChange={v => update('offset', Number(v))}
        />

        <Select.Root
          value={indicator?.direction ?? 'e'}
          onChange={v => update('direction', (v ?? 'e') as Direction)}
          style={{ width: '90%' }}
        >
          <Select.Item value={'e'}>East</Select.Item>
          <Select.Item value={'n'}>North</Select.Item>
          <Select.Item value={'w'}>West</Select.Item>
          <Select.Item value={'s'}>South</Select.Item>
        </Select.Root>
      </div>
    </div>
  );
};
