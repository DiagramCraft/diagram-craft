import { Tree } from '@diagram-craft/app-components/Tree';
import { Diagram } from '@diagram-craft/model/diagram';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { defaultAppActions } from '../../appActionMap';
import { ToolWindowPanel } from '../ToolWindowPanel';

const DiagramLabel = (props: { diagram: Diagram; onValueChange: (v: string) => void }) => {
  return (
    <div
      className={'util-action'}
      onClick={() => {
        props.onValueChange(props.diagram.id);
      }}
    >
      {props.diagram.name}
    </div>
  );
};

const DiagramTreeNode = (props: {
  diagram: Diagram;
  value: string;
  onValueChange: (v: string) => void;
}) => {
  return (
    <>
      {props.diagram.diagrams.map(node => (
        <Tree.Node key={node.id} isOpen={true}>
          <Tree.NodeLabel>
            <DiagramLabel diagram={node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
          <Tree.NodeCell>{props.value === node.id ? 'Active' : ''}</Tree.NodeCell>
          {node.diagrams.length > 0 && (
            <Tree.Children>
              <DiagramTreeNode
                diagram={node}
                onValueChange={props.onValueChange}
                value={props.value}
              />
            </Tree.Children>
          )}
        </Tree.Node>
      ))}
    </>
  );
};

export const DocumentPanel = () => {
  const diagram = useDiagram();
  const document = useDocument();
  const application = useApplication();
  const redraw = useRedraw();
  useEventListener(document, 'diagramChanged', redraw);
  useEventListener(document, 'diagramAdded', redraw);
  useEventListener(document, 'diagramRemoved', redraw);

  const onValueChange = (v: string) => {
    application.model.activeDiagram = application.model.activeDocument.byId(v)!;
    application.actions = makeActionMap(defaultAppActions)(application);
  };

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'document'} title={'Document'}>
      <Tree.Root>
        {document.diagrams.map(node => (
          <Tree.Node key={node.id} isOpen={true} data-state={diagram.id === node.id ? 'on' : 'off'}>
            <Tree.NodeLabel>
              <DiagramLabel diagram={node} onValueChange={onValueChange} />
            </Tree.NodeLabel>
            <Tree.NodeCell>{diagram.id === node.id ? 'Active' : ''}</Tree.NodeCell>
            {node.diagrams.length > 0 && (
              <Tree.Children>
                <DiagramTreeNode diagram={node} onValueChange={onValueChange} value={diagram.id} />
              </Tree.Children>
            )}
          </Tree.Node>
        ))}
      </Tree.Root>
    </ToolWindowPanel>
  );
};
