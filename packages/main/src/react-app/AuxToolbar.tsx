import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { TbEye, TbZoomIn, TbZoomInArea, TbZoomOut, TbZoomScan } from 'react-icons/tb';
import { useApplication } from '../application';

export const AuxToolbar = () => {
  const application = useApplication();
  return (
    <div className={'_extra-tools'}>
      <Toolbar.Root>
        <Toolbar.Button onClick={() => application.actions['PREVIEW']?.execute()}>
          <TbEye size={'17.5px'} />
        </Toolbar.Button>

        <Toolbar.Button onClick={() => application.actions['ZOOM_OUT']?.execute()}>
          <TbZoomOut size={'17.5px'} />
        </Toolbar.Button>
        <Toolbar.Button onClick={() => application.actions['ZOOM_IN']?.execute()}>
          <TbZoomIn size={'17.5px'} />
        </Toolbar.Button>
        <Toolbar.Button onClick={() => application.tool.set('zoom')}>
          <TbZoomInArea size={'17.5px'} />
        </Toolbar.Button>
        <Toolbar.Button
          onClick={() => application.actions['ZOOM_FIT']?.execute({ rulerWidth: 15 })}
        >
          <TbZoomScan size={'17.5px'} />
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
};
