import { useCallback, useState } from 'react';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { orpcClient } from '../../lib/orpcClient';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

/**
 * Opens a diagram only if its stored content exists. Otherwise it stays on the current page
 * and shows an error dialog. Render the returned `dialog` somewhere in the calling component.
 */
export const useOpenDiagram = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const [missing, setMissing] = useState(false);

  const openDiagram = useCallback(
    async (fileId: string, navigate: () => void) => {
      let exists = false;
      try {
        ({ exists } = await orpcClient.projects.hasDiagramContent({
          params: { workspace: workspaceSlug, fileId }
        }));
      } catch {
        exists = false;
      }

      if (exists) navigate();
      else setMissing(true);
    },
    [workspaceSlug]
  );

  const dialog = (
    <ErrorDialog
      open={missing}
      title="Cannot open diagram"
      message="This diagram's content is missing."
      onClose={() => setMissing(false)}
    />
  );

  return { openDiagram, dialog };
};
