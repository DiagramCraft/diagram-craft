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
import { ActionToolbarButton } from './ActionToolbarButton.tsx';
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
import { useDiagram } from '../context/DiagramContext.tsx';

export const Toolbar = () => {
  const diagram = useDiagram();

  const [enabled, setEnabled] = useState(false);
  useEventListener(diagram.selectionState, 'change', () => {
    setEnabled(!diagram.selectionState.isEmpty());
  });

  return (
    <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
      {enabled && (
        <>
          <NodeFillToolbarButton />
          <NodeStrokeToolbarButton />
          <TextToolbarButton />
          <ShadowToolbarButton />

          <CustomPropertiesToolbarButton />

          <ReactToolbar.Separator className="cmp-toolbar__separator" />

          <ActionToolbarButton action={'ALIGN_TOP'}>
            <TbLayoutAlignTop />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_BOTTOM'}>
            <TbLayoutAlignBottom />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_LEFT'}>
            <TbLayoutAlignLeft />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_RIGHT'}>
            <TbLayoutAlignRight />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_CENTER_VERTICAL'}>
            <TbLayoutAlignCenter />
          </ActionToolbarButton>
          <ActionToolbarButton action={'ALIGN_CENTER_HORIZONTAL'}>
            <TbLayoutAlignMiddle />
          </ActionToolbarButton>
          <ActionToolbarButton action={'DISTRIBUTE_VERTICAL'}>
            <TbLayoutDistributeHorizontal />
          </ActionToolbarButton>
          <ActionToolbarButton action={'DISTRIBUTE_HORIZONTAL'}>
            <TbLayoutDistributeVertical />
          </ActionToolbarButton>

          <ReactToolbar.Separator className="cmp-toolbar__separator" />

          <CanvasGridToolbarButton />

          <CanvasSnapToolbarButton />

          <ActionToggleButton action={'TOGGLE_RULER'}>
            <TbRuler />
          </ActionToggleButton>
        </>
      )}
      {!enabled && (
        <>
          <CanvasGridToolbarButton />

          <CanvasSnapToolbarButton />

          <ActionToggleButton action={'TOGGLE_RULER'}>
            <TbRuler />
          </ActionToggleButton>
        </>
      )}
    </ReactToolbar.Root>
  );
};
