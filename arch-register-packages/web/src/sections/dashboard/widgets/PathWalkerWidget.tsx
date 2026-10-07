import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { PathWalkerView } from '../../entities/components/PathWalkerView';
import type { BrowserEntityRecord } from '../../entities/components/entityBrowserState';
import {
  findRootSchema,
  isPathWalkerConfigComplete,
  resolveWalkerHops,
  type PathWalkerWidgetConfig
} from './pathWalkerWidgetLogic';
import styles from './PathWalkerWidget.module.css';

const FETCH_LIMIT = 1000;

/**
 * Generic multi-column relationship walker: lists every entity of one type and lets the viewer
 * follow a chain of relations column by column (selection and hop choices are local state, seeded
 * from the configured chain). Wraps `PathWalkerView`, the same view the `path-walker` saved-view
 * mode renders.
 */
export const PathWalkerWidget = ({ config }: { config: PathWalkerWidgetConfig }) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isPathWalkerConfigComplete(config);
  const rootSchema = findRootSchema(config, schemas);

  const roots = useEntities(
    workspaceSlug,
    { schemaId: rootSchema?.id, view: 'summary', limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && complete && !!rootSchema }
  );

  const walkerConfig = useMemo(
    () => ({ hops: resolveWalkerHops(config, relationSchemas) }),
    [config, relationSchemas]
  );

  if (!complete || (!rootSchema && schemas.length > 0)) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }

  return (
    <div className={styles.walker}>
      <PathWalkerView
        rows={roots.data as BrowserEntityRecord[]}
        schemas={schemas}
        relationSchemas={relationSchemas}
        workspaceId={workspaceSlug}
        config={walkerConfig}
        onEntityClick={publicId => openEntityDrawer(publicId)}
        isLoading={roots.isLoading}
        lockHops={walkerConfig.hops.length > 0}
      />
    </div>
  );
};
