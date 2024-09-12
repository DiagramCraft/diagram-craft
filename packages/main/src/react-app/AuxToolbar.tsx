import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import { TbHelpSquare, TbMoon, TbSun, TbZoomIn, TbZoomOut } from 'react-icons/tb';
import { application } from '../application';
import { useRedraw } from './hooks/useRedraw';
import { useActions } from './context/ActionsContext';
import { useEventListener } from './hooks/useEventListener';

const DarkModeToggleButton = () => {
  const redraw = useRedraw();
  const { actionMap } = useActions();
  useEventListener(actionMap['TOGGLE_DARK_MODE']!, 'actionchanged', redraw);
  return (
    <Toolbar.Button onClick={() => actionMap['TOGGLE_DARK_MODE']?.execute()}>
      {actionMap['TOGGLE_DARK_MODE']?.getState({}) ? (
        <TbSun size={'17.5px'} />
      ) : (
        <TbMoon size={'17.5px'} />
      )}
    </Toolbar.Button>
  );
};
export const AuxToolbar = () => {
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
