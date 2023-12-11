import {
  TbLayoutAlignBottom,
  TbLayoutAlignCenter,
  TbLayoutAlignLeft,
  TbLayoutAlignMiddle,
  TbLayoutAlignRight,
  TbLayoutAlignTop,
  TbLayoutDistributeHorizontal,
  TbLayoutDistributeVertical,
  TbRuler
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { ActionToolbarButton } from './ActionToolbarButton.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useState } from 'react';
import { CanvasGridToolbarButton } from '../ObjectProperties/CanvasGridToolbarButton.tsx';
import { CanvasSnapToolbarButton } from '../ObjectProperties/CanvasSnapToolbarButton.tsx';
import { NodeFillToolbarButton } from '../ObjectProperties/NodeFillToolbarButton.tsx';
import { ShadowToolbarButton } from '../ObjectProperties/ShadowToolbarButton.tsx';
import { NodeStrokeToolbarButton } from '../ObjectProperties/NodeStrokeToolbarButton.tsx';
import { ActionToggleButton } from './ActionToggleButton.tsx';
import { TextToolbarButton } from '../ObjectProperties/TextToolbarButton.tsx';
import { CustomPropertiesToolbarButton } from '../ObjectProperties/CustomPropertiesToolbarButton.tsx';

export const Toolbar = (props: Props) => {
  const [enabled, setEnabled] = useState(false);
  useEventListener(props.diagram.selectionState, 'change', () => {
    setEnabled(!props.diagram.selectionState.isEmpty());
  });

  return (
    <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
      {enabled && (
        <>
          <NodeFillToolbarButton diagram={props.diagram} />
          <NodeStrokeToolbarButton diagram={props.diagram} />
          <TextToolbarButton diagram={props.diagram} />
          <ShadowToolbarButton diagram={props.diagram} />

          <CustomPropertiesToolbarButton diagram={props.diagram} />

          <ReactToolbar.Separator className="cmp-toolbar__separator" />

          <ActionToolbarButton action={'ALIGN_TOP'} {...props}>
            <TbLayoutAlignTop />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_BOTTOM'} {...props}>
            <TbLayoutAlignBottom />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_LEFT'} {...props}>
            <TbLayoutAlignLeft />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_RIGHT'} {...props}>
            <TbLayoutAlignRight />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_CENTER_VERTICAL'} {...props}>
            <TbLayoutAlignCenter />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_CENTER_HORIZONTAL'} {...props}>
            <TbLayoutAlignMiddle />
          </ActionToolbarButton>
          <ActionToolbarButton action={'DISTRIBUTE_VERTICAL'} {...props}>
            <TbLayoutDistributeHorizontal />
          </ActionToolbarButton>
          <ActionToolbarButton action={'DISTRIBUTE_HORIZONTAL'} {...props}>
            <TbLayoutDistributeVertical />
          </ActionToolbarButton>

          <ReactToolbar.Separator className="cmp-toolbar__separator" />

          <CanvasGridToolbarButton
            actionMap={props.actionMap}
            keyMap={props.keyMap}
            diagram={props.diagram}
          />

          <CanvasSnapToolbarButton
            actionMap={props.actionMap}
            keyMap={props.keyMap}
            diagram={props.diagram}
          />

          <ActionToggleButton actionMap={props.actionMap} action={'TOGGLE_RULER'}>
            <TbRuler />
          </ActionToggleButton>
        </>
      )}
      {!enabled && (
        <>
          <CanvasGridToolbarButton
            actionMap={props.actionMap}
            keyMap={props.keyMap}
            diagram={props.diagram}
          />

          <CanvasSnapToolbarButton
            actionMap={props.actionMap}
            keyMap={props.keyMap}
            diagram={props.diagram}
          />

          <ActionToggleButton actionMap={props.actionMap} action={'TOGGLE_RULER'}>
            <TbRuler />
          </ActionToggleButton>
        </>
      )}
    </ReactToolbar.Root>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
