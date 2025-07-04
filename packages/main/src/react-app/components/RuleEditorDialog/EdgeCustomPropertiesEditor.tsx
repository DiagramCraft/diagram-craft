import type { Editor } from './editors';
import { newid } from '@diagram-craft/utils/id';
import { deepClone } from '@diagram-craft/utils/object';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { ElementCustomPropertiesPanelForm } from '../../toolwindow/ObjectToolWindow/ElementCustomPropertiesPanel';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { sortBy } from '@diagram-craft/utils/array';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { useDiagram } from '../../../application';

export const EdgeCustomPropertiesEditor: Editor = props => {
  const $p = props.props as EdgeProps;
  const $d = useDiagram();

  const [type, setType] = useState('');

  const edge = DiagramEdge.create(
    newid(),
    new FreeEndpoint({ x: 0, y: 0 }),
    new FreeEndpoint({ x: 100, y: 100 }),
    deepClone($p),
    {},
    [],
    $d.activeLayer
  );

  const edgeTypesWithCustomProps: string[] = [];
  for (const key of $d.document.edgeDefinitions.list()) {
    const def = $d.document.edgeDefinitions.get(key);
    const customProps = def.getCustomPropertyDefinitions(edge);
    if (customProps.length > 0) {
      edgeTypesWithCustomProps.push(key);
    }
  }
  sortBy(edgeTypesWithCustomProps, e => $d.document.edgeDefinitions.get(e).name);

  const onChange = () => {
    props.onChange();
  };

  return (
    <div>
      <div>
        <Select.Root
          value={type}
          placeholder={'Node type'}
          onChange={k => {
            setType(k ?? '');
            $p.custom = {};
            onChange();
          }}
          style={{ width: '100%', marginBottom: '0.75rem' }}
        >
          {edgeTypesWithCustomProps.map(e => {
            return (
              <Select.Item key={e} value={e}>
                {$d.document.edgeDefinitions.get(e).name}
              </Select.Item>
            );
          })}
        </Select.Root>
      </div>

      {type !== 'rect' && type !== '' && (
        <div>
          <ElementCustomPropertiesPanelForm
            element={edge}
            customProperties={$d.document.edgeDefinitions
              .get(type)
              .getCustomPropertyDefinitions(edge)}
            onChange={(_value: CustomPropertyDefinition) => {
              return (cb: (uow: UnitOfWork) => void) => {
                const uow = new UnitOfWork($d, false);
                cb(uow);
                uow.abort();

                $p.custom = edge.storedProps.custom;
                onChange();
              };
            }}
          />
        </div>
      )}
    </div>
  );
};
