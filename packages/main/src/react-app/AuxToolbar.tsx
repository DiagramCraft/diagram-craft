import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import { TbEye, TbHelpSquare, TbZoomIn, TbZoomOut } from 'react-icons/tb';
import { useApplication } from '../application';

export const AuxToolbar = () => {
  const application = useApplication();
  return (
    <div className={'_extra-tools'}>
      <Toolbar.Root>
        <ActionToggleButton action={'TOGGLE_HELP'}>
          <TbHelpSquare size={'17.5px'} />
        </ActionToggleButton>

        <Toolbar.Button onClick={() => application.actions['PREVIEW']?.execute()}>
          <TbEye size={'17.5px'} />
        </Toolbar.Button>

        <Toolbar.Button onClick={() => application.actions['ZOOM_OUT']?.execute()}>
          <TbZoomOut size={'17.5px'} />
        </Toolbar.Button>
        <Toolbar.Button onClick={() => application.actions['ZOOM_IN']?.execute()}>
          <TbZoomIn size={'17.5px'} />
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
};
