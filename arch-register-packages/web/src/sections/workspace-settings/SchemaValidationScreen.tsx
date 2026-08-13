import { useCallback, useMemo, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbAlertTriangle, TbCheck, TbExternalLink, TbRefresh } from 'react-icons/tb';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import { useSchemas } from '../../hooks/useSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './SchemaValidationScreen.module.css';
import {
  validateWorkspaceSchemas,
  type SchemaValidationIssue,
  type SchemaValidationNavigationTarget
} from './schemaValidation';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schema-validation');

const navigationTarget = (workspaceSlug: string, target: SchemaValidationNavigationTarget) => {
  if (target.kind === 'entity-schema') {
    return {
      to: '/$workspaceSlug/settings/schemas' as const,
      params: { workspaceSlug },
      search: { tab: 'types' as const, schema: target.id }
    };
  }

  return {
    to: '/$workspaceSlug/settings/schemas' as const,
    params: { workspaceSlug },
    search: { tab: 'relation-types' as const, relationSchema: target.id }
  };
};

export const SchemaValidationScreen = () => {
  const {
    workspaceSlug,
    schemas: contextSchemas,
    relationSchemas: contextRelations
  } = useWorkspaceContext();
  const navigate = routeApi.useNavigate();
  const {
    data: schemas = contextSchemas,
    isLoading: schemasLoading,
    refetch: refetchSchemas
  } = useSchemas(workspaceSlug);
  const {
    data: relationSchemas = contextRelations,
    isLoading: relationSchemasLoading,
    refetch: refetchRelationSchemas
  } = useRelationSchemas(workspaceSlug);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const issues = useMemo(
    () => validateWorkspaceSchemas(schemas, relationSchemas),
    [relationSchemas, schemas]
  );
  const relationNames = useMemo(
    () => new Map(relationSchemas.map(relation => [relation.id, relation.name])),
    [relationSchemas]
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, SchemaValidationIssue[]>();
    for (const issue of issues) {
      const key = issue.relationSchemaId ?? '__dangling__';
      const group = grouped.get(key) ?? [];
      group.push(issue);
      grouped.set(key, group);
    }
    return [...grouped.entries()];
  }, [issues]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSchemas(), refetchRelationSchemas()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchRelationSchemas, refetchSchemas]);

  const loading = schemasLoading || relationSchemasLoading;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            },
            { label: 'Settings' }
          ]}
          title="Schema Validation"
          description="Review advisory diagnostics across entity and relation schema configuration."
          buttons={
            <Button
              variant="ghost"
              icon={<TbRefresh size={13} />}
              disabled={loading || isRefreshing}
              onClick={() => void refresh()}
            >
              {isRefreshing ? 'Rechecking…' : 'Recheck'}
            </Button>
          }
        />
      </div>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loading}>Checking the current schema configuration…</div>
        )}

        {!loading && issues.length === 0 && (
          <EmptyState
            framed
            icon={<TbCheck size={24} />}
            title="Schema configuration looks good"
            subtitle={`Checked ${schemas.length} entity type${schemas.length === 1 ? '' : 's'} and ${relationSchemas.length} relation type${relationSchemas.length === 1 ? '' : 's'}.`}
          />
        )}

        {!loading && issues.length > 0 && (
          <div className={styles.groups}>
            <div className={styles.summary}>
              <TbAlertTriangle size={16} />
              <span>
                {issues.length} advisory issue{issues.length === 1 ? '' : 's'} found
              </span>
            </div>
            {groups.map(([groupId, groupIssues]) => (
              <section className={styles.group} key={groupId}>
                <h2 className={styles.groupTitle}>
                  {groupId === '__dangling__'
                    ? 'Dangling relation references'
                    : (relationNames.get(groupId) ?? groupId)}
                </h2>
                <div className={styles.issueList}>
                  {groupIssues.map(issue => (
                    <article
                      className={styles.issue}
                      key={`${issue.code}:${issue.entitySchemaId}:${issue.fieldId ?? issue.direction}`}
                    >
                      <div className={styles.issueIcon}>
                        <TbAlertTriangle size={15} />
                      </div>
                      <div className={styles.issueBody}>
                        <div className={styles.issueMessage}>{issue.message}</div>
                        <div className={styles.issueMeta}>
                          {issue.code.replaceAll('_', ' ').toLowerCase()} · advisory warning
                        </div>
                        <div className={styles.mitigation}>
                          <strong>Suggested mitigation:</strong> {issue.mitigation}
                        </div>
                        <div className={styles.links}>
                          {issue.navigationTargets.map(target => (
                            <Link
                              className={styles.link}
                              key={`${target.kind}:${target.id}`}
                              {...navigationTarget(workspaceSlug, target)}
                            >
                              {target.kind === 'entity-schema'
                                ? 'Open entity schema'
                                : 'Open relation schema'}
                              <TbExternalLink size={12} />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
