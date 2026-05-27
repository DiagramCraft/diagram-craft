import { urlToName } from '@diagram-craft/utils/url';
import { DirtyIndicator } from './DirtyIndicator';
import { useApplication } from '../application';

export const DocumentName = (props: { dirty: boolean; name?: string }) => {
  const application = useApplication();

  const loadDocument = async () => {
    application.file.loadDocument(application.model.activeDocument.url!);
  };

  const displayName =
    props.name ??
    (application.model.activeDocument.url
      ? urlToName(application.model.activeDocument.url)
      : 'Untitled');

  return (
    <div id={'document'}>
      {displayName}

      <DirtyIndicator
        dirty={props.dirty}
        onDirtyChange={application.model.activeDocument.url ? loadDocument : undefined}
      />
    </div>
  );
};
