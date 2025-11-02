import { AbstractAction } from '@diagram-craft/canvas/action';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { Application } from '../../application';
import { AppConfig } from '../../appConfig';
import { FileDialog } from '../FileDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';

export const fileSaveAsActions = (application: Application) => ({
  FILE_SAVE_AS: new FileSaveAsAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileSaveAsActions> {}
}

class FileSaveAsAction extends AbstractAction<undefined, Application> {
  async execute(): Promise<void> {
    const currentFilename = this.context.model.activeDocument.url?.split('/').pop() ?? 'diagram.json';

    this.context.ui.showDialog(
      FileDialog.createSaveAs(
        async (path: string) => {
          await saveToPath(this.context, path);
        },
        () => {
          // Dialog closes automatically
        },
        currentFilename
      )
    );
  }
}

async function saveToPath(context: Application, path: string): Promise<void> {
  // Check if file exists
  const fileExists = await checkFileExists(path);

  if (fileExists) {
    // Show confirmation dialog
    context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Overwrite File?',
          message: `The file "${path}" already exists. Do you want to overwrite it?`,
          okLabel: 'Overwrite',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        async () => {
          await performSave(context, path);
        },
        () => {
          // Dialog closes automatically
        }
      )
    );
  } else {
    await performSave(context, path);
  }
}

async function checkFileExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${AppConfig.get().filesystem.endpoint}/api/fs/${path}`);
    if (!response.ok) return false;

    const data = await response.json();
    // If it has content property, it's a file, not a directory
    return data.content !== undefined;
  } catch {
    return false;
  }
}

async function performSave(context: Application, path: string): Promise<void> {
  const serialized = JSON.stringify(await serializeDiagramDocument(context.model.activeDocument));

  const response = await fetch(`${AppConfig.get().filesystem.endpoint}/api/fs/${path}`, {
    method: 'PUT',
    body: serialized,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  // TODO: Show error dialog
  if (data.status !== 'ok') {
    console.error('Failed to save document');
  } else {
    // Update document URL to the new path
    context.model.activeDocument.url = path;
    context.file.clearDirty();
  }
}
