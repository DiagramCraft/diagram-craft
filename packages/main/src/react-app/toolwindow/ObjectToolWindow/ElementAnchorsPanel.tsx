import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from '../ObjectToolWindow/types';
import { useDiagram } from '../../../application';
import { Button } from '@diagram-craft/app-components/Button';
import { useState } from 'react';
import { newid } from '@diagram-craft/utils/id';

export const ElementAnchorsPanel = (props: Props) => {
  const diagram = useDiagram();
  const type = useNodeProperty(diagram, 'anchors.type');
  const perEdge = useNodeProperty(diagram, 'anchors.perEdgeCount');
  const perPathCount = useNodeProperty(diagram, 'anchors.perPathCount');
  const directionsCount = useNodeProperty(diagram, 'anchors.directionsCount');
  const customAnchors = useNodeProperty(diagram, 'anchors.customAnchors', {});

  const [editingAnchor, setEditingAnchor] = useState<string | null>(null);

  const disabled =
    !diagram.selectionState.isNodesOnly() ||
    diagram.selectionState.nodes.some(e => !e.getDefinition().supports('anchors-configurable'));

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="anchors"
      title={'Anchor Points'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor
            property={type as Property<string>}
            render={props => (
              <Select.Root {...props}>
                <Select.Item value={'none'}>No anchors</Select.Item>
                <Select.Item value={'shape-defaults'}>Default</Select.Item>
                <Select.Item value={'north-south'}>North/South</Select.Item>
                <Select.Item value={'east-west'}>East/West</Select.Item>
                <Select.Item value={'directions'}>x anchors (direction)</Select.Item>
                <Select.Item value={'per-path'}>x anchors (length)</Select.Item>
                <Select.Item value={'per-edge'}>x per edge</Select.Item>
                <Select.Item value={'custom'}>Custom</Select.Item>
              </Select.Root>
            )}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Number:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={
              type.val === 'per-edge'
                ? perEdge.val
                : type.val === 'directions'
                  ? directionsCount.val
                  : type.val === 'per-path'
                    ? perPathCount.val
                    : 0
            }
            disabled={
              disabled ||
              (type.val !== 'per-edge' && type.val !== 'directions' && type.val !== 'per-path')
            }
            onChange={v => {
              if (type.val === 'per-edge') {
                perEdge.set(v);
              } else if (type.val === 'directions') {
                directionsCount.set(v);
              } else if (type.val === 'per-path') {
                perPathCount.set(v);
              }
            }}
          />
        </div>

        {type.val === 'custom' && (
          <>
            <div className={'cmp-labeled-table__label'}>Anchors:</div>
            <div className={'cmp-labeled-table__value'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(customAnchors.val ?? {}).map(([id, anchor]) => (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  >
                    {editingAnchor === id ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                          <span style={{ fontSize: '12px', minWidth: '15px' }}>x:</span>
                          <NumberInput
                            value={anchor.x ?? 0}
                            onChange={x => {
                              const newAnchors = { ...(customAnchors.val ?? {}) };
                              newAnchors[id] = { ...newAnchors[id], x: x ?? 0 };
                              customAnchors.set(newAnchors);
                            }}
                            style={{ width: '60px' }}
                          />
                          <span style={{ fontSize: '12px', minWidth: '15px' }}>y:</span>
                          <NumberInput
                            value={anchor.y ?? 0}
                            onChange={y => {
                              const newAnchors = { ...(customAnchors.val ?? {}) };
                              newAnchors[id] = { ...newAnchors[id], y: y ?? 0 };
                              customAnchors.set(newAnchors);
                            }}
                            style={{ width: '60px' }}
                          />
                        </div>
                        <Button
                          type="icon-only"
                          onClick={() => setEditingAnchor(null)}
                          style={{ padding: '4px' }}
                        >
                          ✓
                        </Button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, fontSize: '12px' }}>
                          x: {(anchor.x ?? 0).toFixed(2)}, y: {(anchor.y ?? 0).toFixed(2)}
                        </div>
                        <Button
                          type="icon-only"
                          onClick={() => setEditingAnchor(id)}
                          style={{ padding: '4px' }}
                        >
                          ✎
                        </Button>
                        <Button
                          type="icon-only"
                          onClick={() => {
                            const newAnchors = { ...(customAnchors.val ?? {}) };
                            delete newAnchors[id];
                            customAnchors.set(newAnchors);
                            if (editingAnchor === id) {
                              setEditingAnchor(null);
                            }
                          }}
                          style={{ padding: '4px' }}
                        >
                          ×
                        </Button>
                      </>
                    )}
                  </div>
                ))}

                <Button
                  onClick={() => {
                    const id = newid();
                    const newAnchors = { ...(customAnchors.val ?? {}) };
                    newAnchors[id] = { x: 0, y: 0 };
                    customAnchors.set(newAnchors);
                    setEditingAnchor(id);
                  }}
                  disabled={disabled}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Add Anchor
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
