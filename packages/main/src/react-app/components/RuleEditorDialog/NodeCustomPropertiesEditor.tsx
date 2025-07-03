import type { Editor } from './editors';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { deepClone } from '@diagram-craft/utils/object';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { ElementCustomPropertiesPanelForm } from '../../toolwindow/ObjectToolWindow/ElementCustomPropertiesPanel';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { sortBy } from '@diagram-craft/utils/array';
import { useDiagram } from '../../../application';

export const NodeCustomPropertiesEditor: Editor = props => {
  const $p = props.props as NodeProps;
  const $d = useDiagram();

  const [type, setType] = useState('');

  const node = new DiagramNode(
    newid(),
    type === '' ? 'rect' : type,
    { x: 0, y: 0, w: 1000, h: 1000, r: 0 },
    $d.activeLayer,
    deepClone($p),
    {}
  );

  const nodeTypesWithCustomProps: string[] = [];
  for (const key of $d.document.nodeDefinitions.list()) {
    const def = $d.document.nodeDefinitions.get(key);
    const customProps = def.getCustomPropertyDefinitions(node);
    if (customProps.length > 0) {
      nodeTypesWithCustomProps.push(key);
    }
  }
  sortBy(nodeTypesWithCustomProps, e => $d.document.nodeDefinitions.get(e).name);

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
          {nodeTypesWithCustomProps.map(e => {
            return (
              <Select.Item key={e} value={e}>
                {$d.document.nodeDefinitions.get(e).name}
              </Select.Item>
            );
          })}
        </Select.Root>
      </div>

      {type !== 'rect' && type !== '' && (
        <div>
          <ElementCustomPropertiesPanelForm
            element={node}
            customProperties={$d.document.nodeDefinitions
              .get(type)
              .getCustomPropertyDefinitions(node)}
            onChange={(_value: CustomPropertyDefinition) => {
              return (cb: (uow: UnitOfWork) => void) => {
                const uow = new UnitOfWork($d, false);
                cb(uow);
                uow.abort();

                $p.custom = node.storedProps.custom;
                onChange();
              };
            }}
          />
        </div>
      )}
    </div>
  );
};
