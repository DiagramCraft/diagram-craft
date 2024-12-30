import { useDiagram } from '../../../application';
import { useElementProperty } from '../../hooks/useProperty';
import { Indicator } from '@diagram-craft/model/diagramProps';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { IndicatorForm } from './IndicatorForm';
import { deepClone } from '@diagram-craft/utils/object';

export const DefaultIndicatorPanel = (props: { mode?: 'accordion' | 'panel' }) => {
  const $d = useDiagram();
  const indicators = useElementProperty($d, 'indicators');

  const update = <K extends keyof Indicator>(id: string, key: K, value: Indicator[K]) => {
    const newIndicator: Indicator = deepClone(indicators.val[id]);
    newIndicator[key] = value;

    const newIndicators = { ...indicators.val };
    newIndicators[id] = newIndicator;
    indicators.set(newIndicators);
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="indicator"
      title={'Indicator'}
      hasCheckbox={true}
      value={indicators.val['_default']?.enabled}
      onChange={() => {
        update('_default', 'enabled', !indicators.val['_default']?.enabled);
      }}
    >
      <IndicatorForm
        indicator={indicators.val['_default']}
        update={(key, value) => {
          update('_default', key, value);
        }}
      />
    </ToolWindowPanel>
  );
};
