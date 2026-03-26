import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram, useDocument } from '../../../application';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Diagram } from '@diagram-craft/model/diagram';
import React from 'react';
import type { Property } from '@diagram-craft/model/property';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';
import type { NodeAction, NodeProps } from '@diagram-craft/model/diagramProps';
import { TbPlus, TbTrash } from 'react-icons/tb';

const DiagramList = (props: { list: readonly Diagram[]; level: number }) => {
  return (
    <>
      {props.list.map(diagram => {
        return (
          <React.Fragment key={diagram.id}>
            <Select.Item value={diagram.id}>
              <span style={{ width: `${props.level * 10}px`, display: 'inline-block' }} />
              {diagram.name}
            </Select.Item>
            <DiagramList list={diagram.diagrams} level={props.level + 1} />
          </React.Fragment>
        );
      })}
    </>
  );
};

type ActionsProperty = Property<NonNullable<NodeProps['actions']>>;

const makeEmptyAction = (): NodeAction => ({
  label: 'New Action',
  type: 'none',
  url: ''
});

const addAction = (actions: ActionsProperty) => {
  actions.set({
    ...actions.val,
    [newid()]: makeEmptyAction()
  });
};

export const NodeActionPropertiesPanelForm = ({ actions }: { actions: ActionsProperty }) => {
  const document = useDocument();
  const diagram = useDiagram();
  const actionEntries = Object.entries(actions.val ?? {});

  const updateAction = (id: string, updater: (action: NodeAction) => NodeAction) => {
    const currentAction = actions.val[id];
    if (currentAction === undefined) return;

    actions.set({
      ...actions.val,
      [id]: updater(currentAction)
    });
  };

  const removeAction = (id: string) => {
    const nextActions = { ...actions.val };
    delete nextActions[id];
    actions.set(nextActions);
  };

  return (
    <KeyValueTable.Root>
      {actions.hasMultipleValues && (
        <KeyValueTable.FullRow>
          Editing will replace the action set on all selected nodes.
        </KeyValueTable.FullRow>
      )}

      {actionEntries.length === 0 && (
        <KeyValueTable.FullRow>No actions defined.</KeyValueTable.FullRow>
      )}

      {actionEntries.map(([id, action], index) => (
        <React.Fragment key={id}>
          <KeyValueTable.Label>Label:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <div className={'util-hstack'} style={{ gap: '0.5rem' }}>
              <TextInput
                value={action.label}
                onChange={value =>
                  updateAction(id, current => ({
                    ...current,
                    label: value ?? ''
                  }))
                }
                style={{ flex: 1 }}
              />
              <Button variant={'icon-only'} onClick={() => removeAction(id)} title={'Remove action'}>
                <TbTrash />
              </Button>
            </div>
          </KeyValueTable.Value>

          <KeyValueTable.Label>Type:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <Select.Root
              value={action.type}
              onChange={value =>
                updateAction(id, current => ({
                  ...current,
                  type: (value ?? 'none') as NodeAction['type']
                }))
              }
            >
              <Select.Item value={'none'}>None</Select.Item>
              <Select.Item value={'url'}>URL</Select.Item>
              <Select.Item value={'diagram'}>Sheet</Select.Item>
              <Select.Item value={'layer'}>Toggle Layer</Select.Item>
            </Select.Root>
          </KeyValueTable.Value>

          {action.type === 'url' && (
            <>
              <KeyValueTable.Label>URL:</KeyValueTable.Label>
              <KeyValueTable.Value>
                <TextInput
                  value={action.url ?? ''}
                  onChange={value =>
                    updateAction(id, current => ({
                      ...current,
                      url: value ?? ''
                    }))
                  }
                />
              </KeyValueTable.Value>
            </>
          )}

          {action.type === 'diagram' && (
            <>
              <KeyValueTable.Label>Diagram:</KeyValueTable.Label>
              <KeyValueTable.Value>
                <Select.Root
                  value={action.url ?? ''}
                  onChange={value =>
                    updateAction(id, current => ({
                      ...current,
                      url: value ?? ''
                    }))
                  }
                  placeholder={'Select'}
                >
                  <DiagramList level={0} list={document.diagrams} />
                </Select.Root>
              </KeyValueTable.Value>
            </>
          )}

          {action.type === 'layer' && (
            <>
              <KeyValueTable.Label>Layer:</KeyValueTable.Label>
              <KeyValueTable.Value>
                <Select.Root
                  value={action.url ?? ''}
                  onChange={value =>
                    updateAction(id, current => ({
                      ...current,
                      url: value ?? ''
                    }))
                  }
                  placeholder={'Select'}
                >
                  {diagram.layers.all.map(layer => (
                    <Select.Item key={layer.id} value={layer.id}>
                      {layer.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </KeyValueTable.Value>
            </>
          )}

          {index < actionEntries.length - 1 && (
            <KeyValueTable.FullRow>
              <div
                style={{
                  borderTop: '1px solid var(--cmp-border)',
                  margin: '0 -1rem'
                }}
              />
            </KeyValueTable.FullRow>
          )}
        </React.Fragment>
      ))}

    </KeyValueTable.Root>
  );
};

export const NodeActionPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const actions = useNodeProperty(diagram, 'actions', {});

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="action-props"
      title={'Action'}
      hasCheckbox={false}
      headerButtons={
        <a onClick={() => addAction(actions)}>
          <TbPlus />
        </a>
      }
    >
      <NodeActionPropertiesPanelForm actions={actions} />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
