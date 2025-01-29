import { Tree } from '@diagram-craft/app-components/Tree';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Accordion } from '@diagram-craft/app-components/Accordion';

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
        <Tree.Node key={node.id}>
          <Tree.NodeLabel>
            <DiagramLabel diagram={node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
          <Tree.NodeValue>{props.value === node.id ? 'Active' : ''}</Tree.NodeValue>
          {node.diagrams.length > 0 && (
            <DiagramTreeNode
              diagram={node}
              onValueChange={props.onValueChange}
              value={props.value}
            />
          )}
        </Tree.Node>
      ))}
    </>
  );
};

export const DocumentToolWindow = (props: Props) => {
  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['document']}>
      <Accordion.Item value="document">
        <Accordion.ItemHeader>Document structure</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <Tree.Root>
            {props.document.topLevelDiagrams.map(node => (
              <Tree.Node key={node.id} isOpen={true}>
                <Tree.NodeLabel>
                  <DiagramLabel diagram={node} onValueChange={props.onValueChange} />
                </Tree.NodeLabel>
                <Tree.NodeValue>{props.value === node.id ? 'Active' : ''}</Tree.NodeValue>
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
