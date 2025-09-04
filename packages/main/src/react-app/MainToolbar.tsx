import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import {
  TbLine,
  TbLocation,
  TbPencil,
  TbPhotoPlus,
  TbPlus,
  TbPointer,
  TbPolygon,
  TbSquarePlus2,
  TbTablePlus,
  TbTextSize
} from 'react-icons/tb';
import { ActionToolbarButton } from './toolbar/ActionToolbarButton';

export const MainToolbar = () => {
  return (
    <div className={'_tools'}>
      <Toolbar.Root size={'large'}>
        <ActionToggleButton action={'TOOL_MOVE'}>
          <TbPointer size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_RECT'}>
          <TbSquarePlus2 size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_EDGE'}>
          <TbLine size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_TEXT'}>
          <TbTextSize size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_FREEHAND'}>
          <TbPencil size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_PEN'}>
          <TbPolygon size={'17.5px'} />
        </ActionToggleButton>
        <ActionToggleButton action={'TOOL_NODE'}>
          <TbLocation size={'17.5px'} transform={'scale(-1,1)'} />
        </ActionToggleButton>
        <Toolbar.Separator />
        <ActionToolbarButton action={'IMAGE_INSERT'}>
          <TbPhotoPlus size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_INSERT'}>
          <TbTablePlus size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'SHAPE_INSERT'}>
          <TbPlus size={'17.5px'} />
        </ActionToolbarButton>
        <Toolbar.Separator />
      </Toolbar.Root>
    </div>
  );
};
