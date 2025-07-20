import { Tree } from '@diagram-craft/app-components/Tree';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

const DiagramLabel = (props: { diagram: Diagram } & Pick<Props, 'onValueChange'>) => {
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

const DiagramTreeNode = (props: { diagram: Diagram } & Pick<Props, 'value' | 'onValueChange'>) => {
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

export const DocumentToolWindow = (props: Props) => {
  const document = useDocument();
  const redraw = useRedraw();
  useEventListener(document, 'diagramChanged', redraw);
  useEventListener(document, 'diagramAdded', redraw);
  useEventListener(document, 'diagramRemoved', redraw);

  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['document']}>
      <Accordion.Item value="document">
        <Accordion.ItemHeader>Document structure</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <Tree.Root>
            {props.document.diagrams.map(node => (
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
          </Tree.Root>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  document: DiagramDocument;
};
