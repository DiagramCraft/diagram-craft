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
    const newIndicator: Indicator = deepClone(indicators.val[id]) ?? {
      enabled: false
    };
    newIndicator[key] = value;

    const newIndicators = { ...indicators.val };
    newIndicators[id] = newIndicator;
    indicators.set(newIndicators);
  };

  const shape = useElementProperty($d, 'indicators._default.shape');
  const color = useElementProperty($d, 'indicators._default.color');
  const width = useElementProperty($d, 'indicators._default.width');
  const height = useElementProperty($d, 'indicators._default.height');
  const offset = useElementProperty($d, 'indicators._default.offset');
  const direction = useElementProperty($d, 'indicators._default.direction');
  const position = useElementProperty($d, 'indicators._default.position');

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
      forceMount={true}
    >
      <IndicatorForm
        shape={shape}
        color={color}
        width={width}
        height={height}
        offset={offset}
        direction={direction}
        position={position}
      />
    </ToolWindowPanel>
  );
};
