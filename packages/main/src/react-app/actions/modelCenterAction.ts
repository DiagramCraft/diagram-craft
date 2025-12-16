import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { $tStr } from '@diagram-craft/utils/localize';

export class ModelCenterAction extends AbstractAction<undefined, Application> {
  name = $tStr('action.MODEL_CENTER.name', 'Model Center');

  execute() {
    this.context.ui.showDialog({
      id: 'modelCenter',
      props: {},
      onOk: () => {},
      onCancel: () => {}
    });
  }
}

export const modelCenterActions = (application: Application) => ({
  MODEL_CENTER: new ModelCenterAction(application)
});
