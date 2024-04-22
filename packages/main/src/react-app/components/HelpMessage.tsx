import { ApplicationState } from '@diagram-craft/canvas/ApplicationState';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../useRedraw';
import { TbX } from 'react-icons/tb';

export const HelpMessage = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.applicationState, 'helpChange', () => {
    redraw();
  });

  return (
    <div id="help">
      <div className={'messsage'}>
        {props.applicationState.help && props.applicationState.help.message}
      </div>
      <button
        onClick={() => {
          props.actionMap['TOGGLE_HELP']?.execute();
        }}
      >
        <TbX />
      </button>
    </div>
  );
};

type Props = {
  applicationState: ApplicationState;
  actionMap: Partial<ActionMap>;
};
