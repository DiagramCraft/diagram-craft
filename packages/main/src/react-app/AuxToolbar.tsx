import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import { TbHelpSquare, TbMoon, TbSun, TbZoomIn, TbZoomOut } from 'react-icons/tb';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { useApplication } from '../application';

const DarkModeToggleButton = () => {
  const redraw = useRedraw();
  const application = useApplication();
  const actionMap = application.actions;
  useEventListener(actionMap['TOGGLE_DARK_MODE']!, 'actionChanged', redraw);
  return (
    <Toolbar.Button onClick={() => actionMap['TOGGLE_DARK_MODE']?.execute()}>
      {actionMap['TOGGLE_DARK_MODE']?.getState(undefined) ? (
        <TbSun size={'17.5px'} />
      ) : (
        <TbMoon size={'17.5px'} />
      )}
    </Toolbar.Button>
  );
};
export const AuxToolbar = () => {
  const application = useApplication();
  return (
    <div className={'_extra-tools'}>
      <Toolbar.Root>
        <ActionToggleButton action={'TOGGLE_HELP'}>
          <TbHelpSquare size={'17.5px'} />
        </ActionToggleButton>

        <Toolbar.Button onClick={() => application.actions['ZOOM_OUT']?.execute()}>
          <TbZoomOut size={'17.5px'} />
        </Toolbar.Button>
        <Toolbar.Button onClick={() => application.actions['ZOOM_IN']?.execute()}>
          <TbZoomIn size={'17.5px'} />
        </Toolbar.Button>

        <DarkModeToggleButton />
      </Toolbar.Root>
    </div>
  );
};
