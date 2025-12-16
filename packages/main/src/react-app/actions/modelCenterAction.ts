import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';

export class ModelCenterAction extends AbstractAction<undefined, Application> {
  name = 'Model Center';

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
