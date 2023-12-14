import { DiagramDocument } from '../model-viewer/diagramDocument.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { Tree, TreeNode } from './components/Tree.tsx';

const DiagramLabel = (props: { diagram: EditableDiagram } & Pick<Props, 'onValueChange'>) => {
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

const DiagramTreeNode = (
  props: { diagram: EditableDiagram } & Pick<Props, 'value' | 'onValueChange'>
) => {
  return (
    <>
      {props.diagram.diagrams.map(node => (
        <TreeNode
          key={node.id}
          label={<DiagramLabel diagram={node} onValueChange={props.onValueChange} />}
          value={props.value === node.id ? 'Active' : ''}
        >
          {node.diagrams.length > 0 && (
            <DiagramTreeNode
              diagram={node}
              onValueChange={props.onValueChange}
              value={props.value}
            />
          )}
        </TreeNode>
      ))}
    </>
  );
};

export const DocumentToolWindow = (props: Props) => {
  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['document']}>
      <Accordion.Item className="cmp-accordion__item" value="document">
        <AccordionTrigger>Document structure</AccordionTrigger>
        <AccordionContent>
          <div style={{ margin: '-0.5rem' }}>
            <Tree>
              {props.document.diagrams.map(node => (
                <TreeNode
                  key={node.id}
                  label={<DiagramLabel diagram={node} onValueChange={props.onValueChange} />}
                  isOpen={true}
                  value={props.value === node.id ? 'Active' : ''}
                >
                  {node.diagrams.length > 0 && (
                    <DiagramTreeNode
                      diagram={node}
                      onValueChange={props.onValueChange}
                      value={props.value}
                    />
                  )}
                </TreeNode>
              ))}
            </Tree>
          </div>
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  document: DiagramDocument<EditableDiagram>;
};
