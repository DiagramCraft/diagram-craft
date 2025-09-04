import type { Editor } from './editors';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { makeProperty } from './utils';
import { IndicatorForm } from '../../toolwindow/ObjectToolWindow/IndicatorForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const path = (id: string, rest: string): any => `indicators.${id}.${rest}`;

export const NamedIndicatorEditor: Editor = props => {
  const [id, setId] = useState<string>('name');
  const $p = props.props as NodeProps;

  const onChange = () => {
    props.onChange();
  };

  // @ts-ignore
  const shape = makeProperty($p, path(id, 'shape'), nodeDefaults, onChange);
  const color = makeProperty($p, path(id, 'color'), nodeDefaults, onChange);
  const width = makeProperty($p, path(id, 'width'), nodeDefaults, onChange);
  const height = makeProperty($p, path(id, 'height'), nodeDefaults, onChange);
  const offset = makeProperty($p, path(id, 'offset'), nodeDefaults, onChange);
  const direction = makeProperty($p, path(id, 'direction'), nodeDefaults, onChange);
  const position = makeProperty($p, path(id, 'position'), nodeDefaults, onChange);
  const enabled = makeProperty($p, path(id, 'enabled'), nodeDefaults, onChange);

  return (
    <div>
      <div className={'cmp-labeled-table'} style={{ marginBottom: '0.5rem' }}>
        <div className={'cmp-labeled-table__label'}>Name:</div>
        <div className={'cmp-labeled-table__value'}>
          <TextInput
            value={id}
            onChange={v => {
              $p.indicators ??= {};
              $p.indicators![v ?? ''] = $p.indicators![id];
              delete $p.indicators![id];

              setId(v ?? '');
              onChange();
            }}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Enabled:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <Checkbox
            value={enabled.val}
            onChange={v => {
              enabled.set(v);
              onChange();
            }}
          />
        </div>
      </div>

      <IndicatorForm
        shape={shape}
        color={color}
        width={width}
        height={height}
        offset={offset}
        direction={direction}
        position={position}
      />
    </div>
  );
};
