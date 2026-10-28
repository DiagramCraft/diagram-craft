import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { TrailView } from '../../../sections/entities/components/TrailView';
import { type BrowserEntityRecord } from '../../../sections/entities/components/entityBrowserState';
import styles from './PathWalker.module.css';
import {
  findRootSchema,
  resolveWalkerHops,
  type PathWalkerWidgetConfig
} from './pathWalkerWidgetLogic';

const FETCH_LIMIT = 1000;

/**
 * Generic multi-column relationship walker: lists every entity of one type and lets the viewer
 * follow a chain of relations column by column (selection and hop choices are local state, seeded
 * from the configured chain). Wraps `TrailView`, the same view the `path-walker` saved-view
 * mode renders.
 */
export const PathWalkerWidget = ({ config }: { config: PathWalkerWidgetConfig }) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const rootSchema = findRootSchema(config, schemas);

  const roots = useEntities(
    workspaceSlug,
    { schemaId: rootSchema?.id, view: 'summary', limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && !!rootSchema }
  );

  const walkerConfig = useMemo(
    () => ({ hops: resolveWalkerHops(config, relationSchemas) }),
    [config, relationSchemas]
  );

  if (!rootSchema && schemas.length > 0) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }

  return (
    <div className={styles.walker}>
      <TrailView
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
