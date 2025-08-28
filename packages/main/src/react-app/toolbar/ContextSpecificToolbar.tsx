import { TbArrowsExchange2, TbBold, TbItalic, TbRuler, TbUnderline } from 'react-icons/tb';
import { ActionToolbarButton } from './ActionToolbarButton';
import { useEventListener } from '../hooks/useEventListener';
import { useCallback, useEffect, useState } from 'react';
import { ActionToggleButton } from './ActionToggleButton';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { ElementTextFontToolbarButton } from '../toolwindow/ObjectToolWindow/ElementTextFontToolbarButton';
import { ElementTextFontSizeToolbarButton } from '../toolwindow/ObjectToolWindow/ElementTextFontSizeToolbarButton';
import { ElementTextToolbarButton } from '../toolwindow/ObjectToolWindow/ElementTextToolbarButton';
import { NodeFillToolbarButton } from '../toolwindow/ObjectToolWindow/NodeFillToolbarButton';
import { NodeStrokeToolbarButton } from '../toolwindow/ObjectToolWindow/NodeStrokeToolbarButton';
import { EdgeLineToolbarButton } from '../toolwindow/ObjectToolWindow/EdgeLineToolbarButton';
import { ElementShadowToolbarButton } from '../toolwindow/ObjectToolWindow/ElementShadowToolbarButton';
import { ElementCustomPropertiesToolbarButton } from '../toolwindow/ObjectToolWindow/ElementCustomPropertiesToolbarButton';
import { CanvasGridToolbarButton } from '../toolwindow/ObjectToolWindow/CanvasGridToolbarButton';
import { CanvasSnapToolbarButton } from '../toolwindow/ObjectToolWindow/CanvasSnapToolbarButton';
import { CanvasGuidesToolbarButton } from '../toolwindow/ObjectToolWindow/CanvasGuidesToolbarButton';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ElementStylesheetToolbarButton } from '../toolwindow/ObjectToolWindow/ElementStylesheetToolbarButton';
import { CommentToolbarButton } from './CommentToolbarButton';
import { useDiagram } from '../../application';

export const ContextSpecificToolbar = () => {
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
    <Toolbar.Root>
      {isTextSelection && (
        <>
          <ElementStylesheetToolbarButton selectionType={selectionType} nodeType={nodeType} />

          <ElementTextFontToolbarButton />
          <ElementTextFontSizeToolbarButton />

          <Toolbar.Separator style={{ marginRight: '-5px', backgroundColor: 'transparent' }} />

          <ActionToggleButton action={'TEXT_BOLD'}>
            <TbBold />
          </ActionToggleButton>
          <ActionToggleButton action={'TEXT_ITALIC'}>
            <TbItalic />
          </ActionToggleButton>
          <ActionToggleButton action={'TEXT_UNDERLINE'}>
            <TbUnderline />
          </ActionToggleButton>
          <ElementTextToolbarButton />
        </>
      )}

      {!isTextSelection && (isNodeSelection || isMixedSelection) && (
        <>
          <ElementStylesheetToolbarButton selectionType={selectionType} nodeType={nodeType} />

          <NodeFillToolbarButton />
          <NodeStrokeToolbarButton />
        </>
      )}

      {isEdgeSelection && (
        <>
          <ElementStylesheetToolbarButton selectionType={selectionType} nodeType={nodeType} />

          <EdgeLineToolbarButton />
          <ActionToolbarButton action={'EDGE_FLIP'}>
            <TbArrowsExchange2 />
          </ActionToolbarButton>
          <ElementShadowToolbarButton />
        </>
      )}

      {isNodeSelection && !isTextSelection && (
        <>
          <ElementTextToolbarButton />
          <ElementShadowToolbarButton />
          <ElementCustomPropertiesToolbarButton />
        </>
      )}

      {(isNodeSelection || isMixedSelection || isEdgeSelection) && <Toolbar.Separator />}

      {/*selectionType !== 'empty' && selectionType !== undefined && (
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

          <Toolbar.Separator />

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

          <Toolbar.Separator />
        </>
      )*/}

      <CanvasGridToolbarButton />

      <CanvasGuidesToolbarButton />

      <CanvasSnapToolbarButton />

      <ActionToggleButton action={'TOGGLE_RULER'}>
        <TbRuler />
      </ActionToggleButton>

      <Toolbar.Separator />

      <CommentToolbarButton />
    </Toolbar.Root>
  );
};
