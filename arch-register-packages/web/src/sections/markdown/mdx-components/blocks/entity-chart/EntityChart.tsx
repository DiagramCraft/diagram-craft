import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useEntities } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { resolveSchemaColor, schemaColor } from '../../../../../lib/api';
import styles from './EntityChart.module.css';

type ChartGroup = { key: string; label: string; count: number; color: string };

const polarToCartesian = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeDonutSegment = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string => {
  const sweep = Math.min(endDeg - startDeg, 359.9);
  const end = startDeg + sweep;
  const largeArc = sweep > 180 ? 1 : 0;

  const os = polarToCartesian(cx, cy, outerR, startDeg);
  const oe = polarToCartesian(cx, cy, outerR, end);
  const ie = polarToCartesian(cx, cy, innerR, end);
  const is_ = polarToCartesian(cx, cy, innerR, startDeg);

  return [
    `M ${os.x} ${os.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oe.x} ${oe.y}`,
    `L ${ie.x} ${ie.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${is_.x} ${is_.y}`,
    'Z'
  ].join(' ');
};

const DonutChart = ({ groups, total }: { groups: ChartGroup[]; total: number }) => {
  const segments = useMemo(() => {
    let startDeg = 0;
    return groups.map(g => {
      const sweep = (g.count / total) * 360;
      const path = describeDonutSegment(100, 100, 75, 45, startDeg, startDeg + sweep);
      startDeg += sweep;
      return { ...g, path };
    });
  }, [groups, total]);

  return (
    <svg width={200} height={200} viewBox="0 0 200 200">
      {segments.map(seg => (
        <path
          key={seg.key}
          d={seg.path}
          fill={seg.color}
          stroke="var(--base-bg)"
          strokeWidth={2}
        />
      ))}
      <text
        x="100"
        y="100"
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.donutCenter}
      >
        {total}
      </text>
    </svg>
  );
};

const BarChart = ({ groups }: { groups: ChartGroup[] }) => {
  const maxCount = Math.max(...groups.map(g => g.count), 1);
  const rowHeight = 28;
  const svgHeight = groups.length * rowHeight + 16;

  return (
    <svg width={280} height={svgHeight} viewBox={`0 0 280 ${svgHeight}`}>
      {groups.map((g, i) => {
        const y = 8 + i * rowHeight;
        const barWidth = (g.count / maxCount) * 140;
        return (
          <g key={g.key}>
            <text x={0} y={y + 16} className={styles.barLabel}>
              {g.label.length > 18 ? `${g.label.slice(0, 17)}…` : g.label}
            </text>
            <rect x={112} y={y} height={18} width={Math.max(barWidth, 4)} rx={3} fill={g.color} />
            <text x={112 + Math.max(barWidth, 4) + 6} y={y + 13} className={styles.barCount}>
              {g.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

type Props = {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  groupBy?: string;
  chartType?: string;
};

export const EntityChart = ({ schema, owner, lifecycle, groupBy = 'lifecycle', chartType = 'donut' }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();

  const hasFilter = !!(schema || owner || lifecycle);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: schema === '' ? undefined : schema,
      owner: owner === '' ? undefined : owner,
      lifecycle: lifecycle === '' ? undefined : lifecycle,
      view: 'full',
      limit: 500
    },
    { enabled: !!workspaceSlug && hasFilter }
  );

  const groups = useMemo((): ChartGroup[] => {
    const counts = new Map<string, { label: string; count: number; colorIndex: number }>();

    for (const entity of entities) {
      let key: string;
      let label: string;

      if (groupBy === 'owner') {
        key = entity._owner?.id ?? '__none__';
        label = entity._owner?.name ?? '(no owner)';
      } else if (groupBy === 'schema') {
        key = entity._schema.id;
        label = schemas.find(s => s.id === key)?.name ?? entity._schema.name;
      } else {
        key = entity._lifecycle?.id ?? '__none__';
        label = lifecycleStates.find(s => s.id === key)?.label ?? '(no status)';
      }

      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { label, count: 1, colorIndex: counts.size });
      }
    }

    return Array.from(counts.entries())
      .map(([key, { label, count, colorIndex }]) => {
        let color: string;
        if (groupBy === 'lifecycle') {
          color = lifecycleStates.find(s => s.id === key)?.color ?? schemaColor(colorIndex);
        } else if (groupBy === 'schema') {
          const schemaDef = schemas.find(s => s.id === key);
          color = schemaDef ? resolveSchemaColor(schemaDef, schemas.indexOf(schemaDef)) : schemaColor(colorIndex);
        } else {
          color = schemaColor(colorIndex);
        }
        return { key, label, count, color };
      })
      .sort((a, b) => b.count - a.count);
  }, [entities, groupBy, schemas, lifecycleStates]);

  if (!hasFilter) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No filters configured.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No entities match the current filters.</p>
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className={styles.card}>
      <div className={styles.chartArea}>
        {chartType === 'bar' ? (
          <BarChart groups={groups} />
        ) : (
          <DonutChart groups={groups} total={total} />
        )}
        {chartType !== 'bar' && (
          <div className={styles.legend}>
            {groups.map(g => (
              <div key={g.key} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: g.color }} />
                <span className={styles.legendLabel}>{g.label}</span>
                <span className={styles.legendCount}>{g.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {chartType === 'bar' && (
        <div className={styles.legend}>
          {groups.map(g => (
            <div key={g.key} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: g.color }} />
              <span className={styles.legendLabel}>{g.label}</span>
              <span className={styles.legendCount}>{g.count}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className={styles.viewLink}
        onClick={() => {
          const conditions = [
            ...(schema ? [{ fieldId: '_schemaId', op: 'equals' as const, value: schema }] : []),
            ...(lifecycle ? [{ fieldId: '_lifecycle', op: 'equals' as const, value: lifecycle }] : []),
            ...(owner ? [{ fieldId: '_owner', op: 'equals' as const, value: owner }] : [])
          ];
          navigate({
            to: '/$workspaceSlug/entities',
            params: { workspaceSlug },
            search: { filters: conditions.length > 0 ? JSON.stringify(conditions) : undefined }
          });
        }}
      >
        View in catalog <TbArrowRight size={12} />
      </button>
    </div>
  );
};
