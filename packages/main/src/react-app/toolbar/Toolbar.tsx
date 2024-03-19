import {
  TbArrowsExchange2,
  TbBold,
  TbItalic,
  TbLayoutAlignBottom,
  TbLayoutAlignCenter,
  TbLayoutAlignLeft,
  TbLayoutAlignMiddle,
  TbLayoutAlignRight,
  TbLayoutAlignTop,
  TbLayoutDistributeHorizontal,
  TbLayoutDistributeVertical,
  TbRuler,
  TbStackBack,
  TbStackFront,
  TbStackPop,
  TbStackPush,
  TbUnderline
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ActionToolbarButton } from './ActionToolbarButton.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useCallback, useEffect, useState } from 'react';
import { CanvasGridToolbarButton } from '../ObjectProperties/CanvasGridToolbarButton.tsx';
import { CanvasSnapToolbarButton } from '../ObjectProperties/CanvasSnapToolbarButton.tsx';
import { NodeFillToolbarButton } from '../ObjectProperties/NodeFillToolbarButton.tsx';
import { ShadowToolbarButton } from '../ObjectProperties/ShadowToolbarButton.tsx';
import { NodeStrokeToolbarButton } from '../ObjectProperties/NodeStrokeToolbarButton.tsx';
import { ActionToggleButton } from './ActionToggleButton.tsx';
import { TextToolbarButton } from '../ObjectProperties/TextToolbarButton.tsx';
import { CustomPropertiesToolbarButton } from '../ObjectProperties/CustomPropertiesToolbarButton.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { SelectionType } from '../../model/selectionState.ts';
import { TextFontToolbarButton } from '../ObjectProperties/TextFontToolbarButton.tsx';
import { TextFontSizeToolbarButton } from '../ObjectProperties/TextFontSizeToolbarButton.tsx';
import { LineToolbarButton } from '../ObjectProperties/LineToolbarButton.tsx';

export const Toolbar = () => {
  const diagram = useDiagram();

  const [selectionType, setSelectionType] = useState<SelectionType | undefined>(undefined);
  const [nodeType, setNodeType] = useState<string | undefined>(undefined);

  const callback = useCallback(() => {
    setSelectionType(diagram.selectionState.getSelectionType());
    if (diagram.selectionState.isNodesOnly() && diagram.selectionState.nodes.length === 1) {
      setNodeType(diagram.selectionState.nodes[0].nodeType);
    } else {
      setNodeType(undefined);
    }
  }, [diagram]);

  useEventListener(diagram.selectionState, 'add', callback);
  useEventListener(diagram.selectionState, 'remove', callback);
  useEffect(callback, [callback]);

  const isNodeSelection =
    selectionType === 'nodes' ||
    selectionType === 'single-node' ||
    selectionType === 'single-label-node';
  const isMixedSelection = selectionType === 'mixed';
  const isEdgeSelection = selectionType === 'edges' || selectionType === 'single-edge';
  const isTextSelection = nodeType === 'text';

  return (
    <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
      {isTextSelection && (
        <>
          <TextFontToolbarButton />
          <TextFontSizeToolbarButton />

          <ActionToggleButton action={'TEXT_BOLD'}>
            <TbBold />
          </ActionToggleButton>
          <ActionToggleButton action={'TEXT_ITALIC'}>
            <TbItalic />
          </ActionToggleButton>
          <ActionToggleButton action={'TEXT_UNDERLINE'}>
            <TbUnderline />
          </ActionToggleButton>
          <TextToolbarButton />
        </>
      )}

      {!isTextSelection && (isNodeSelection || isMixedSelection) && (
        <>
          <NodeFillToolbarButton />
          <NodeStrokeToolbarButton />
        </>
      )}

      {isEdgeSelection && (
        <>
          <LineToolbarButton />
          <ActionToolbarButton action={'EDGE_FLIP'}>
            <TbArrowsExchange2 />
          </ActionToolbarButton>
          <ShadowToolbarButton />
        </>
      )}

      {isNodeSelection && !isTextSelection && (
        <>
          <TextToolbarButton />
          <ShadowToolbarButton />
          <CustomPropertiesToolbarButton />
        </>
      )}

      {(isNodeSelection || isMixedSelection || isEdgeSelection) && (
        <ReactToolbar.Separator className="cmp-toolbar__separator" />
      )}

      {selectionType !== 'empty' && (
        <>
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

          <ActionToolbarButton action={'SELECTION_RESTACK_BOTTOM'}>
            <TbStackBack />
          </ActionToolbarButton>
          <ActionToolbarButton action={'SELECTION_RESTACK_TOP'}>
            <TbStackFront />
          </ActionToolbarButton>
          <ActionToolbarButton action={'SELECTION_RESTACK_UP'}>
            <TbStackPop />
          </ActionToolbarButton>
          <ActionToolbarButton action={'SELECTION_RESTACK_DOWN'}>
            <TbStackPush />
          </ActionToolbarButton>

          <ReactToolbar.Separator className="cmp-toolbar__separator" />
        </>
      )}

      <CanvasGridToolbarButton />

      <CanvasSnapToolbarButton />

      <ActionToggleButton action={'TOGGLE_RULER'}>
        <TbRuler />
      </ActionToggleButton>
    </ReactToolbar.Root>
  );
};
