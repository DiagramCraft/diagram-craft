import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import { TbX } from 'react-icons/tb';
import styles from './HelpMessage.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { HelpState } from '../HelpState';
import { UserState } from '../../UserState';
import { useApplication } from '../../application';

export const HelpMessage = (props: Props) => {
  const redraw = useRedraw();
  const application = useApplication();

  useEventListener(props.helpState, 'helpChange', redraw);
  useEventListener(UserState.get(), 'change', redraw);

  const help = props.helpState.help;
  if (!help || !UserState.get().showHelp) {
    return null;
  }

  return (
    <div id="help" className={styles.icHelp}>
      <div>{help.message}</div>
      <Button
        variant={'icon-only'}
        onMouseDown={event => {
          // This is to prevent conflict with dnd event handling
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={() => application.actions['TOGGLE_HELP']?.execute()}
      >
        <TbX />
      </Button>
    </div>
  );
};

type Props = {
  helpState: HelpState;
};
