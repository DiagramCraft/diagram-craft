import { TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useEffect, useState } from 'react';
import * as ReactToolbar from '@radix-ui/react-toolbar';

export const LineProperties = (props: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState('straight');

  const toggleEnabled = () => {
    if (
      props.diagram.selectionState.edges.length > 0 &&
      props.diagram.selectionState.nodes.length === 0
    ) {
      setEnabled(true);
      setType(props.diagram.selectionState.edges[0].props.type ?? 'straight');
    } else {
      setEnabled(false);
    }
  };

  useEventListener('change', toggleEnabled, props.diagram.selectionState);
  useEffect(toggleEnabled, [props.diagram.selectionState]);

  return (
    <div>
      {enabled && (
        <>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={type}
              onValueChange={value => {
                props.diagram.selectionState.edges.forEach(e => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  e.props.type = value as unknown as any;
                  props.diagram.updateElement(e);
                });
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'straight'}>
                <TbLine />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'orthogonal'}>
                <TbShape3 />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'curved'}>
                <TbVectorSpline />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bezier'}>
                <TbVectorBezier2 />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </>
      )}
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
