import {
  TbArrowAutofitWidth,
  TbArrowsMoveHorizontal,
  TbGrid3X3,
  TbLayout,
  TbLayoutAlignBottom,
  TbLayoutAlignCenter,
  TbLayoutAlignLeft,
  TbLayoutAlignMiddle,
  TbLayoutAlignRight,
  TbLayoutAlignTop,
  TbLayoutDistributeHorizontal,
  TbLayoutDistributeVertical,
  TbMoon,
  TbPlus
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { KeyMap } from '../../canvas/keyMap.ts';
import { ActionToolbarButton } from './ActionToolbarButton.tsx';
import { ActionToggleGroup } from './ActionToggleGroup.tsx';
import { ActionToggleItem } from './ActionToggleItem.tsx';

export const Toolbar = (props: Props) => {
  return (
    <ReactToolbar.Root className="ToolbarRoot" aria-label="Formatting options">
      <ActionToggleGroup {...props}>
        <ActionToggleItem action={'TOGGLE_ANCHOR_TYPE_GRID'} {...props}>
          <TbGrid3X3 />
        </ActionToggleItem>
        <ActionToggleItem action={'TOGGLE_ANCHOR_TYPE_NODE'} {...props}>
          <TbLayout />
        </ActionToggleItem>
        <ActionToggleItem action={'TOGGLE_ANCHOR_TYPE_CANVAS'} {...props}>
          <TbPlus />
        </ActionToggleItem>
        <ActionToggleItem action={'TOGGLE_ANCHOR_TYPE_DISTANCE'} {...props}>
          <TbArrowsMoveHorizontal />
        </ActionToggleItem>
        <ActionToggleItem action={'TOGGLE_ANCHOR_TYPE_SIZE'} {...props}>
          <TbArrowAutofitWidth />
        </ActionToggleItem>
      </ActionToggleGroup>

      <ReactToolbar.Separator className="ToolbarSeparator" />

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

      <ReactToolbar.Separator className="ToolbarSeparator" />

      <ActionToggleGroup {...props}>
        <ActionToggleItem action={'TOGGLE_DARK_MODE'} {...props}>
          <TbMoon />
        </ActionToggleItem>
      </ActionToggleGroup>
    </ReactToolbar.Root>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
