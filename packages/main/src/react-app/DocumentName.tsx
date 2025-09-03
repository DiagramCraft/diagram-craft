import { urlToName } from '@diagram-craft/utils/url';
import { DirtyIndicator } from './DirtyIndicator';
import { useApplication } from '../application';

export const DocumentName = (props: { dirty: boolean }) => {
  const application = useApplication();

  const loadDocument = async () => {
    application.file.loadDocument(application.model.activeDocument.url!);
  };

  return (
    <div className={'_document'}>
      {application.model.activeDocument.url
        ? urlToName(application.model.activeDocument.url)
        : 'Untitled'}

      <DirtyIndicator
        dirty={props.dirty}
        onDirtyChange={application.model.activeDocument.url ? loadDocument : undefined}
      />
    </div>
  );
};
