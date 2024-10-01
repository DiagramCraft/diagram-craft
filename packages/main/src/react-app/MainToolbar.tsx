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
import { urlToName } from '@diagram-craft/utils/url';
import { DirtyIndicator } from './DirtyIndicator';
import { useApplication } from '../application';

export const MainToolbar = ({ dirty }: { dirty: boolean }) => {
  const application = useApplication();
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
        <ActionToolbarButton action={'IMAGE_INSERT'}>
          <TbPlus size={'17.5px'} />
        </ActionToolbarButton>
        <Toolbar.Separator />
      </Toolbar.Root>

      <div className={'_document'}>
        {application.model.activeDocument.url
          ? urlToName(application.model.activeDocument.url)
          : 'Untitled'}

        <DirtyIndicator
          dirty={dirty}
          onDirtyChange={
            application.model.activeDocument.url
              ? async () => {
                  application.file.loadDocument(application.model.activeDocument.url!);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
