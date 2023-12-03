import { TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useEffect, useState } from 'react';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ArrowSelector } from './ArrowSelector.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { ColorPicker } from '../ColorPicker.tsx';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useEdgeProperty } from './useEdgeProperty.ts';

export const LineProperties = (props: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState('straight');
  const redraw = useRedraw();

  const [strokeColor, setStrokeColor] = useEdgeProperty(
    'stroke.color',
    props.diagram,
    'transparent'
  );
  const [pattern, setPattern] = useEdgeProperty('stroke.pattern', props.diagram, 'SOLID');

  const [strokSize, setStrokeSize] = useEdgeProperty('stroke.patternSize', props.diagram, '100');
  const [strokeSpacing, setStrokeSpacing] = useEdgeProperty(
    'stroke.patternSpacing',
    props.diagram,
    '100'
  );
  const [strokeWidth, setStrokeWidth] = useEdgeProperty('stroke.width', props.diagram, '1');

  // TODO: We should have a mixed state - in case the edges have different values
  const edge = props.diagram.selectionState.edges[0];

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
    redraw();
  };

  useEventListener('edgechanged', toggleEnabled, props.diagram);
  useEventListener('change', toggleEnabled, props.diagram.selectionState);
  useEffect(toggleEnabled, [props.diagram.selectionState]);

  return (
    <div>
      {enabled && (
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Type:</div>
          <div className={'cmp-labeled-table__value'}>
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
          </div>

          <div className={'cmp-labeled-table__label'}>Line start:</div>
          <div className={'cmp-labeled-table__value'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ArrowSelector
                value={edge.props.arrow?.start?.type}
                onValueChange={value => {
                  props.diagram.selectionState.edges.forEach(e => {
                    e.props.arrow ??= {};
                    e.props.arrow.start ??= {};
                    e.props.arrow.start.type = value;
                    props.diagram.updateElement(e);
                  });
                }}
              />
              &nbsp;
              <input
                type={'number'}
                value={edge.props.arrow?.start?.size ?? 100}
                min={1}
                style={{ width: '50px' }}
                onChange={ev => {
                  props.diagram.selectionState.edges.forEach(e => {
                    e.props.arrow ??= {};
                    e.props.arrow.start ??= {};
                    e.props.arrow.start.size = ev.target.valueAsNumber;
                    props.diagram.updateElement(e);
                  });
                }}
              />
            </div>
          </div>

          <div className={'cmp-labeled-table__label'}>Line end:</div>
          <div className={'cmp-labeled-table__value'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ArrowSelector
                value={edge.props.arrow?.end?.type}
                onValueChange={value => {
                  props.diagram.selectionState.edges.forEach(e => {
                    e.props.arrow ??= {};
                    e.props.arrow.end ??= {};
                    e.props.arrow.end.type = value;
                    props.diagram.updateElement(e);
                  });
                }}
              />
              &nbsp;
              <input
                type={'number'}
                value={edge.props.arrow?.end?.size ?? 100}
                min={1}
                style={{ width: '50px' }}
                onChange={ev => {
                  props.diagram.selectionState.edges.forEach(e => {
                    e.props.arrow ??= {};
                    e.props.arrow.end ??= {};
                    e.props.arrow.end.size = ev.target.valueAsNumber;
                    props.diagram.updateElement(e);
                  });
                }}
              />
            </div>
          </div>

          <div className={'cmp-labeled-table__label'}>Color:</div>
          <div className={'cmp-labeled-table__value'}>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={strokeColor ?? 'transparent'}
              onClick={setStrokeColor}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Width:</div>
          <div className={'cmp-labeled-table__value'}>
            <input
              type={'number'}
              value={strokeWidth ?? 1}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                setStrokeWidth(ev.target.value);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Dash:</div>
          <div className={'cmp-labeled-table__value'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <DashSelector
                value={pattern}
                onValueChange={value => {
                  setPattern(value);
                }}
              />
              &nbsp;
              <input
                type={'number'}
                value={strokSize ?? 100}
                min={1}
                style={{ width: '45px' }}
                onChange={ev => {
                  setStrokeSize(ev.target.value);
                }}
              />
              &nbsp;
              <input
                type={'number'}
                value={strokeSpacing ?? 100}
                min={1}
                style={{ width: '45px' }}
                onChange={ev => {
                  setStrokeSpacing(ev.target.value);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
