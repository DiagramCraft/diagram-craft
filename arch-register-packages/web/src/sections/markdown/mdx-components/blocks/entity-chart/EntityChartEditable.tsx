import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityChart } from './EntityChart';
import { EntityChartDialog } from './EntityChartDialog';
import type { EntityChartSlateElement } from './types';

export const ENTITY_CHART_TYPE = 'EntityChart' as const;

export const entityChartMdxRule = defineLeafMdxRule<EntityChartSlateElement, 'block'>({
  name: ENTITY_CHART_TYPE,
  mode: 'block',
  fields: [
    { key: 'schema' },
    { key: 'owner' },
    { key: 'lifecycle' },
    { key: 'groupBy', default: 'lifecycle' },
    { key: 'chartType', attr: 'type', default: 'donut' }
  ]
});

export const EntityChartEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityChartSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const groupBy = element.groupBy ?? '';
  const chartType = element.chartType ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      placeholder={<span>Configure entity chart…</span>}
      content={
        <EntityChart
          schema={schema === '' ? undefined : schema}
          owner={owner === '' ? undefined : owner}
          lifecycle={lifecycle === '' ? undefined : lifecycle}
          groupBy={groupBy === '' ? undefined : groupBy}
          chartType={chartType === '' ? undefined : chartType}
        />
      }
      dialog={(open, onClose) => (
        <EntityChartDialog element={element} open={open} onClose={onClose} isNew={!hasValue} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
