import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';

export class CommandPaletteAction extends AbstractAction<undefined, Application> {
  name = 'Command Palette';
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
