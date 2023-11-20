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
  TbPlus
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { KeyMap } from '../../canvas/keyMap.ts';
import { ActionToolbarButton } from './ActionToolbarButton.tsx';

export const Toolbar = (props: Props) => {
  return (
    <ReactToolbar.Root className="ToolbarRoot" aria-label="Formatting options">
      <ReactToolbar.ToggleGroup
        type="multiple"
        aria-label="Text formatting"
        defaultValue={['grid', 'node', 'canvas', 'size', 'guides']}
        onValueChange={value => {
          console.log(value);
        }}
      >
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="grid" aria-label="Bold">
          <TbGrid3X3 />
        </ReactToolbar.ToggleItem>
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="node" aria-label="Italic">
          <TbLayout />
        </ReactToolbar.ToggleItem>
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="canvas" aria-label="Italic">
          <TbPlus />
        </ReactToolbar.ToggleItem>
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="distance" aria-label="Italic">
          <TbArrowsMoveHorizontal />
        </ReactToolbar.ToggleItem>
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="size" aria-label="Italic">
          <TbArrowAutofitWidth />
        </ReactToolbar.ToggleItem>
        {/*
        <ReactToolbar.ToggleItem className="ToolbarToggleItem" value="guides" aria-label="Italic">
          <TbBorderInner />
        </ReactToolbar.ToggleItem>
        <ReactToolbar.Button className="ToolbarButton" value="bold" aria-label="Bold">
          <TbLocationCog />
        </ReactToolbar.Button>
        */}
      </ReactToolbar.ToggleGroup>

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
      <ReactToolbar.Button className="ToolbarButton" value="bold" aria-label="Bold">
        <TbLayoutDistributeHorizontal />
      </ReactToolbar.Button>
      <ReactToolbar.Button className="ToolbarButton" value="bold" aria-label="Bold">
        <TbLayoutDistributeVertical />
      </ReactToolbar.Button>
    </ReactToolbar.Root>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
