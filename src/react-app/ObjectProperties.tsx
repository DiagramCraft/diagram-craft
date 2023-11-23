import { ToolWindowAccordion } from './ToolWindowAccordion.tsx';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useState } from 'react';
import { useEventListener } from './hooks/useEventListener.ts';
import { unique } from '../utils/array.ts';
import { ColorGrid } from './ColorGrid.tsx';

export const ObjectProperties = (props: Props) => {
  const [, setState] = useState<string>('test');

  useEventListener(
    'change',
    () => {
      const fillArray = unique(
        props.diagram.selectionState.nodes.map(n => n.props.fill?.color),
        e => e
      ).filter(Boolean);

      if (fillArray.length === 0) setState('none');
      else if (fillArray.length === 1) setState(fillArray[0]!);
      else setState('multiple');
    },
    props.diagram.selectionState
  );

  const setColor = (c: string) => {
    props.diagram.selectionState.nodes.forEach(n => {
      n.props.fill ??= {};
      n.props.fill.color = c;
      props.diagram.updateElement(n);
    });
  };

  return (
    <>
      <ToolWindowAccordion title={'Fill'}>
        <ColorGrid
          primaryColors={[
            '#e54d2e',
            '#d6409f',
            '#8e4ec6',
            '#3e63dd',
            '#46a758',
            '#ffe629',
            '#8d8d8d'
          ]}
          additionalHues={[
            ['#feebe7', '#ffcdc2', '#ec8e7b', '#d13415', '#5c271f'],
            ['#fee9f5', '#f6cee7', '#dd93c2', '#c2298a', '#651249'],
            ['#f7edfe', '#ead5f9', '#be93e4', '#8145b5', '#402060'],
            ['#edf2fe', '#d2deff', '#8da4ef', '#3a5bc7', '#1f2d5c'],
            ['#e9f6e9', '#c9e8ca', '#65ba74', '#2a7e3b', '#203c25'],
            ['#fffab8', '#ffe770', '#d5ae39', '#9e6c00', '#473b1f'],
            ['#f0f0f0', '#e0e0e0', '#bbbbbb', '#646464', '#202020']
          ]}
          onClick={setColor}
        />
      </ToolWindowAccordion>
      <ToolWindowAccordion title={'Stroke'}>Stroke stuff</ToolWindowAccordion>
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
