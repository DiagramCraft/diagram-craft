import { ApplicationState } from '@diagram-craft/canvas/ApplicationState';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import { TbX } from 'react-icons/tb';
import styles from './HelpMessage.module.css';
import { Button } from '@diagram-craft/app-components/Button';

export const HelpMessage = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.applicationState, 'helpChange', () => {
    redraw();
  });

  return (
    <div id="help" className={styles.cmpHelp}>
      <div>{props.applicationState.help && props.applicationState.help.message}</div>
      <Button
        type={'icon-only'}
        onClick={() => {
          props.actionMap['TOGGLE_HELP']?.execute();
        }}
      >
        <TbX />
      </Button>
    </div>
  );
};

type Props = {
  applicationState: ApplicationState;
  actionMap: Partial<ActionMap>;
};
