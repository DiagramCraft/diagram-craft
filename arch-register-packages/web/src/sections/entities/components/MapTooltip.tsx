import styles from './MapView.module.css';
import type { EntityRecord, TreeNode } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MetricConfig, MetricResult } from '@arch-register/api-types/metricContract';
import { HoverCard } from '../../../components/HoverCard';
import {
  EntityHoverCardBody,
  type EntityHoverCardRow
} from '../../../components/EntityHoverCardBody';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  type EntityDisplayField
} from './entityDisplayFields';
import { metricValueLabel } from './mapMetricPresentation';
import { nodeName } from './mapViewTraversal';

// ── EntityTooltip ─────────────────────────────────────────────────────────────

export const EntityTooltip = ({
  node,
  color,
  schemaName,
  isLinked,
  children,
  displayFields,
  schemaMap,
  metricRows
}: {
  node: TreeNode;
  color: string;
  schemaName: string;
  isLinked: boolean;
  children: React.ReactNode;
  displayFields: EntityDisplayField[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  metricRows: EntityHoverCardRow[];
}) => {
  const fieldRows = displayFields
    .filter(f => f.id !== '_description' && f.id !== '_tags')
    .map(option => {
      const field = findEntityDisplayField(option.id, node, schemaMap, displayFields);
      const value = field ? formatEntityDisplayValue(node as EntityRecord, field) : null;
      return value == null ? null : { label: field!.label, value };
    })
    .filter((row): row is { label: string; value: string } => row !== null);
  const rows: EntityHoverCardRow[] = [...metricRows, ...fieldRows];

  return (
    <HoverCard
      anchorClassName={styles.tooltipAnchor}
      sideOffset={6}
      content={
        <EntityHoverCardBody
          name={nodeName(node)}
          description={displayFields.some(f => f.id === '_description') ? node._description : null}
          schemaName={schemaName}
          schemaColor={color}
          tags={displayFields.some(f => f.id === '_tags') ? node._tags : undefined}
          rows={rows}
          titleStyle={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
        />
      }
    >
      {children}
    </HoverCard>
  );
};

export const MetricValueLabel = ({
  node,
  isLeaf,
  metric,
  sourceSchema,
  resultsByBoxId,
  lifecycleStates,
  style
}: {
  node: TreeNode;
  isLeaf: boolean;
  metric: MetricConfig | null;
  sourceSchema: EntitySchema | RelationSchema | undefined;
  resultsByBoxId: Map<string, MetricResult>;
  lifecycleStates: WorkspaceLifecycleState[];
  style?: React.CSSProperties;
}) => {
  const value = metricValueLabel(
    node,
    isLeaf,
    metric,
    sourceSchema,
    resultsByBoxId.get(node._uid),
    lifecycleStates
  );
  if (value == null) return null;
  return (
    <span className={styles.metricValue} style={style}>
      {value}
    </span>
  );
};

export const DuplicateBadge = ({ count }: { count: number | undefined }) =>
  count && count > 0 ? (
    <span className={styles.duplicateBadge} title={`${count} duplicate paths collapsed`}>
      Duplicate ×{count}
    </span>
  ) : null;
