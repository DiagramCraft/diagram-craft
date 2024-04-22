import { ApplicationState } from '@diagram-craft/canvas/ApplicationState';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../useRedraw';

export const StatusBar = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.applicationState, 'helpChange', () => {
    redraw();
  });

  return (
    <div id="status">{props.applicationState.help && props.applicationState.help.message}</div>
  );
};

type Props = {
  applicationState: ApplicationState;
};
