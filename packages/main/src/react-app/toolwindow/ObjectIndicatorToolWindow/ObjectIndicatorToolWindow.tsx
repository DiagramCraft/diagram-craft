import { useCallback, useEffect, useState } from 'react';
import { useDiagram } from '../../../application';
import { Indicator } from '@diagram-craft/model/diagramProps';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useConfiguration } from '../../context/ConfigurationContext';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Direction } from '@diagram-craft/geometry/direction';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Accordion } from '@diagram-craft/app-components/Accordion';

export const ObjectIndicatorToolWindow = (props: Props) => {
  const $cfg = useConfiguration();
  const diagram = useDiagram();

  const [indicators, setIndicators] = useState<Record<string, Indicator>>({});
  const [visible, setVisible] = useState<boolean>(false);

  const update = <K extends keyof Indicator>(id: string, key: K, value: Indicator[K]) => {
    const newIndicator: Indicator = { ...indicators[id] };
    newIndicator[key] = value;

    const newIndicators = { ...indicators };
    newIndicators[id] = newIndicator;
    setIndicators(newIndicators);

    const uow = new UnitOfWork(diagram, true);
    diagram.selectionState.elements[0].updateProps(p => {
      p.indicators ??= {};
      p.indicators![id] = newIndicator;
    }, uow);
    commitWithUndo(uow, 'Update indicator');
  };

  const callback = useCallback(() => {
    const selectionType = diagram.selectionState.getSelectionType();
    if (
      selectionType === 'single-node' ||
      selectionType === 'single-label-node' ||
      selectionType === 'single-edge'
    ) {
      setIndicators(diagram.selectionState.elements[0].editProps.indicators ?? {});
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [diagram.selectionState]);

  useEffect(() => {
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [callback, diagram.selectionState]);

  return (
    <Accordion.Root type="multiple" defaultValue={['indicator', 'implied']}>
      {visible && (
        <>
          <ToolWindowPanel
            mode={props.mode ?? 'accordion'}
            id="indicator"
            title={'Indicator'}
            hasCheckbox={true}
            value={indicators['_default']?.enabled}
            onChange={() => {
              update('_default', 'enabled', !indicators['_default']?.enabled);
            }}
          >
            <div className={'cmp-labeled-table'}>
              <div className={'cmp-labeled-table__label'}>Type:</div>
              <div className={'cmp-labeled-table__value util-vcenter'}>
                <Select.Root
                  value={indicators['_default']?.shape ?? 'disc'}
                  onChange={v => update('_default', 'shape', v ?? 'disc')}
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

              <div className={'cmp-labeled-table__label'}>Direction:</div>
              <div className={'cmp-labeled-table__value util-vcenter'}>
                <Select.Root
                  value={indicators['_default']?.direction ?? 'e'}
                  onChange={v => update('_default', 'direction', (v ?? 'e') as Direction)}
                  style={{ width: '90%' }}
                >
                  <Select.Item value={'e'}>East</Select.Item>
                  <Select.Item value={'n'}>North</Select.Item>
                  <Select.Item value={'w'}>West</Select.Item>
                  <Select.Item value={'s'}>South</Select.Item>
                </Select.Root>
              </div>

              <div className={'cmp-labeled-table__label'}>Color:</div>
              <div className={'cmp-labeled-table__value util-vcenter'}>
                <ColorPicker
                  palette={$cfg.palette.primary}
                  value={indicators['_default']?.color ?? 'red'}
                  onChange={v => update('_default', 'color', v)}
                  customPalette={diagram.document.customPalette.colors}
                  onChangeCustomPalette={(idx, v) =>
                    diagram.document.customPalette.setColor(idx, v)
                  }
                />
              </div>

              <div className={'cmp-labeled-table__label'}>Size:</div>
              <div
                className={'cmp-labeled-table__value util-vcenter'}
                style={{ display: 'grid', gridTemplateColumns: '4rem 4rem', gap: '0.25rem' }}
              >
                <NumberInput
                  value={indicators['_default']?.width ?? 10}
                  label={'w'}
                  onChange={v => update('_default', 'width', Number(v))}
                />
                <NumberInput
                  value={indicators['0']?.height ?? 10}
                  label={'h'}
                  onChange={v => update('_default', 'height', Number(v))}
                />
              </div>

              <div className={'cmp-labeled-table__label'}>Position:</div>
              <div className={'cmp-labeled-table__value util-vcenter'}>
                <Select.Root
                  value={indicators['_default']?.position ?? 'e'}
                  onChange={v => update('_default', 'position', (v ?? 'e') as any)}
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

              <div className={'cmp-labeled-table__label'}>Offset:</div>
              <div className={'cmp-labeled-table__value util-vcenter'}>
                <NumberInput
                  value={indicators['0']?.offset ?? 10}
                  onChange={v => update('_default', 'offset', Number(v))}
                />
              </div>
            </div>
          </ToolWindowPanel>
          {Object.keys(indicators).some(k => k !== '_default') && (
            <ToolWindowPanel
              mode={props.mode ?? 'accordion'}
              id="implied"
              title={'Implied indicators'}
              hasCheckbox={false}
            >
              <ul>
                {Object.keys(indicators)
                  .filter(k => k !== '_default')
                  .toSorted()
                  .map(k => {
                    return <li>{k}</li>;
                  })}
              </ul>
            </ToolWindowPanel>
          )}
        </>
      )}
    </Accordion.Root>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
