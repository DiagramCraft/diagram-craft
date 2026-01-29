import type { Editor } from './editors';
import { newid } from '@diagram-craft/utils/id';
import { deepClone } from '@diagram-craft/utils/object';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { ElementCustomPropertiesPanelForm } from '../../toolwindow/ObjectToolWindow/ElementCustomPropertiesPanel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { sortBy } from '@diagram-craft/utils/array';
import { useDiagram } from '../../../application';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

export const NodeCustomPropertiesEditor: Editor = props => {
  const $p = props.props as NodeProps;
  const $d = useDiagram();

  const [type, setType] = useState('');

  const layer = $d.activeLayer;
  assertRegularLayer(layer);

  const node = ElementFactory.node(
    newid(),
    type === '' ? 'rect' : type,
    { x: 0, y: 0, w: 1000, h: 1000, r: 0 },
    layer,
    deepClone($p),
    {}
  );

  const nodeTypesWithCustomProps: string[] = [];
  for (const key of $d.document.registry.nodes.list()) {
    const def = $d.document.registry.nodes.get(key);
    const customProps = def.getCustomPropertyDefinitions(node);
    if (customProps.entries.length > 0) {
      nodeTypesWithCustomProps.push(key);
    }
  }
  sortBy(nodeTypesWithCustomProps, e => $d.document.registry.nodes.get(e).name);

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
                {$d.document.registry.nodes.get(e).name}
              </Select.Item>
            );
          })}
        </Select.Root>
      </div>

      {type !== 'rect' && type !== '' && (
        <div>
          <ElementCustomPropertiesPanelForm
            element={node}
            customProperties={$d.document.registry.nodes
              .get(type)
              .getCustomPropertyDefinitions(node)}
            onChange={() => {
              return (cb: (uow: UnitOfWork) => void) => {
                UnitOfWork.executeSilently($d, cb);

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
