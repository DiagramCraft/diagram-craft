import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { $tStr } from '@diagram-craft/utils/localize';

export class CommandPaletteAction extends AbstractAction<undefined, Application> {
  name = $tStr('action.COMMAND_PALETTE.name', 'Command Palette');
  availableInCommandPalette = false;

  execute() {
    this.context.ui.showDialog({
      id: 'commandPalette',
      props: {},
      onOk: () => {},
      onCancel: () => {}
    });
  }
}

export const commandPaletteActions = (application: Application) => ({
  COMMAND_PALETTE: new CommandPaletteAction(application)
});
