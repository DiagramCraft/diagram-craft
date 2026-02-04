import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Editor, EDGE_EDITORS, NODE_EDITORS } from '../../components/RuleEditorDialog/editors';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useEffect, useState } from 'react';
import { StylesheetType } from '@diagram-craft/model/diagramStyles';
import { deepClone } from '@diagram-craft/utils/object';
import { useRedraw } from '../../hooks/useRedraw';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { NodeTextEditor } from '../../components/RuleEditorDialog/NodeTextEditor';

export const STYLESHEET_EDITORS = {
  text: [{ name: 'Text', editor: NodeTextEditor }],
  node: [
    { name: 'Fill', editor: NODE_EDITORS['fill'].editor },
    { name: 'Stroke', editor: NODE_EDITORS['stroke'].editor },
    { name: 'Shadow', editor: NODE_EDITORS['shadow'].editor },
    { name: 'Effects', editor: NODE_EDITORS['effects'].editor },
    { name: 'Custom', editor: NODE_EDITORS['nodeCustom'].editor },
    { name: 'Advanced', editor: NODE_EDITORS['advanced'].editor },
    { name: 'Action', editor: NODE_EDITORS['action'].editor }
  ],
  edge: [
    { name: 'Line', editor: EDGE_EDITORS['edgeLine'].editor },
    { name: 'Shadow', editor: EDGE_EDITORS['shadow'].editor },
    { name: 'Effects', editor: EDGE_EDITORS['edgeEffects'].editor },
    { name: 'Custom', editor: EDGE_EDITORS['edgeCustom'].editor }
  ]
};

export const ElementStylesheetDialog = (props: Props) => {
  const redraw = useRedraw();

  const [data, setData] = useState<NodeProps | EdgeProps>(deepClone(props.props));
  useEffect(() => setData(deepClone(props.props)), [props.props]);

  let name = 'Element Stylesheet';
  if (props.type === 'text') name = 'Text Stylesheet';
  if (props.type === 'node') name = 'Node Stylesheet';
  if (props.type === 'edge') name = 'Edge Stylesheet';

  return (
    <Dialog
      open={props.open}
      title={name}
      buttons={[
        { type: 'default', label: 'Save', onClick: () => props.onSave(data) },
        { type: 'cancel', label: 'Cancel', onClick: props.onClose }
      ]}
      onClose={props.onClose}
    >
      <div style={{ marginBottom: '3rem', height: '20rem' }}>
        <Tabs.Root defaultValue={props.editors[0]!.name}>
          <Tabs.List>
            {props.editors.map(e => (
              <Tabs.Trigger key={e.name} value={e.name}>
                {e.name}
              </Tabs.Trigger>
            ))}
            <Tabs.Trigger value="json">JSON</Tabs.Trigger>
          </Tabs.List>
          {props.editors.map(e => (
            <Tabs.Content key={e.name} value={e.name} style={{ height: '100%' }}>
              <div
                style={{
                  padding: '0.5rem 0',
                  overflow: 'auto',
                  maxHeight: '100%',
                  scrollbarGutter: 'stable',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--base-fg-more-dim) var(--panel-bg)'
                }}
              >
                <e.editor props={data} onChange={() => redraw()} />
              </div>
            </Tabs.Content>
          ))}
          <Tabs.Content value="json">
            <div style={{ padding: '0.5rem 0' }}>
              <TextArea
                rows={30}
                cols={60}
                value={JSON.stringify(data ?? {}, undefined, 2)}
                style={{ maxHeight: '275px' }}
                onChange={v => {
                  try {
                    setData(JSON.parse(v ?? ''));
                  } catch (_e) {
                    // Ignore
                  }
                }}
              />
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </Dialog>
  );
};

type Props = {
  props: NodeProps | EdgeProps;
  type: StylesheetType;
  open: boolean;
  onClose: () => void;
  onSave: (props: NodeProps | EdgeProps) => void;
  editors: Array<{ name: string; editor: Editor }>;
};
