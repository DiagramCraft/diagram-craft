import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import { TbX } from 'react-icons/tb';
import styles from './HelpMessage.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { useApplication } from '../../application';
import { HelpState } from '../HelpState';

export const HelpMessage = (props: Props) => {
  const redraw = useRedraw();
  const application = useApplication();
  useEventListener(props.helpState, 'helpChange', () => {
    redraw();
  });

  return (
    <div id="help" className={styles.cmpHelp}>
      <div>{props.helpState.help && props.helpState.help.message}</div>
      <Button
        type={'icon-only'}
        onClick={() => {
          application.actions['TOGGLE_HELP']?.execute();
        }}
      >
        <TbX />
      </Button>
    </div>
  );
};

type Props = {
  helpState: HelpState;
};
