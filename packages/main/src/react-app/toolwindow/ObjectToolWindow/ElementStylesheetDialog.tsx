import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Editor } from '../../components/RuleEditorDialog/editors';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useEffect, useState } from 'react';
import { StylesheetType } from '@diagram-craft/model/diagramStyles';
import { deepClone } from '@diagram-craft/utils/object';
import { useRedraw } from '../../hooks/useRedraw';
import { TextArea } from '@diagram-craft/app-components/TextArea';

export const ElementStylesheetDialog = (props: Props) => {
  const redraw = useRedraw();

  const [data, setData] = useState<DiagramCraft.NodeProps | DiagramCraft.EdgeProps>(
    deepClone(props.props)
  );
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
  props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps;
  type: StylesheetType;
  open: boolean;
  onClose: () => void;
  onSave: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => void;
  editors: Array<{ name: string; editor: Editor }>;
};
