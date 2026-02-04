import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { TbEye, TbZoomIn, TbZoomInArea, TbZoomOut, TbZoomScan } from 'react-icons/tb';
import { ActionToolbarButton } from './toolbar/ActionToolbarButton';

export const AuxToolbar = () => {
  return (
    <div className={'_extra-tools'}>
      <Toolbar.Root>
        <ActionToolbarButton action={'PREVIEW'}>
          <TbEye size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'ZOOM_OUT'}>
          <TbZoomOut size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'ZOOM_IN'}>
          <TbZoomIn size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TOOL_ZOOM'}>
          <TbZoomInArea size={'17.5px'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'ZOOM_FIT'} arg={{ rulerWidth: 15 }}>
          <TbZoomScan size={'17.5px'} />
        </ActionToolbarButton>
      </Toolbar.Root>
    </div>
  );
};
