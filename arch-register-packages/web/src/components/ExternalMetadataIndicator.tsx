import { TbPlugConnected, TbRobot, TbSparkles } from 'react-icons/tb';
import type { ExternalKind, ExternalMetadataResult } from '@arch-register/api-types/common';
import { HoverCard } from './HoverCard';
import {
  HoverCardDescription,
  HoverCardRows,
  HoverCardTitle,
  TooltipChip,
  TooltipChips,
  TooltipRow
} from './HoverCardParts';
import styles from './ExternalMetadataIndicator.module.css';

const STATUS_LABEL: Record<ExternalMetadataResult['status'], string> = {
  success: 'Up to date',
  failed: 'Update failed',
  outdated: 'Outdated'
};

const KIND_ICON: Record<ExternalKind, typeof TbSparkles> = {
  ai: TbSparkles,
  integration: TbPlugConnected,
  automation: TbRobot
};

const KIND_LABEL: Record<ExternalKind, string> = {
  ai: 'AI-generated value',
  integration: 'Value from an external integration',
  automation: 'Automatically computed value'
};

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const ExternalMetadataResultBody = ({
  title,
  result
}: {
  title: string;
  result: ExternalMetadataResult | undefined;
}) => (
  <>
    <HoverCardTitle>{title}</HoverCardTitle>
    {!result ? (
      <HoverCardDescription>No external update yet.</HoverCardDescription>
    ) : (
      <>
        <TooltipChips>
          <TooltipChip
            style={
              result.status === 'outdated'
                ? { color: 'var(--warning-fg, #b8860b)' }
                : result.status === 'failed'
                  ? { color: 'var(--danger-fg, #c94a4a)' }
                  : undefined
            }
          >
            {STATUS_LABEL[result.status]}
          </TooltipChip>
        </TooltipChips>
        {result.explanation && <HoverCardDescription>{result.explanation}</HoverCardDescription>}
        {result.findings && result.findings.length > 0 && (
          <ul className={styles.findingsList}>
            {result.findings.map((finding, index) => (
              <li key={index}>{finding}</li>
            ))}
          </ul>
        )}
        {result.failureNotice && (
          <HoverCardDescription>{result.failureNotice}</HoverCardDescription>
        )}
        <HoverCardRows>
          <TooltipRow label="Source" value={result.source} />
          <TooltipRow label="Updated" value={formatTimestamp(result.timestamp)} />
          {result.sourceVersion != null && (
            <TooltipRow label="Version" value={result.sourceVersion} />
          )}
          {result.requestId != null && <TooltipRow label="Request id" value={result.requestId} />}
          {result.sourceRevision != null && (
            <TooltipRow label="Assessed revision" value={result.sourceRevision} />
          )}
          {result.generatorVersion != null && (
            <TooltipRow label="Generator version" value={result.generatorVersion} />
          )}
        </HoverCardRows>
      </>
    )}
  </>
);

/**
 * Provenance indicator for a read-only, externally-managed field value (schema/document fields
 * carrying `external_kind`). Shows a kind-specific icon (sparkle for `ai`, a generic
 * integration/automation icon otherwise) and a hover card with the latest external result.
 */
export const ExternalMetadataIndicator = ({
  kind,
  title,
  result
}: {
  kind: ExternalKind;
  title?: string;
  result: ExternalMetadataResult | undefined;
}) => {
  const Icon = KIND_ICON[kind];
  const resolvedTitle = title ?? KIND_LABEL[kind];
  return (
    <HoverCard content={<ExternalMetadataResultBody title={resolvedTitle} result={result} />}>
      <button
        type="button"
        className={styles.indicator}
        aria-label={`${resolvedTitle} — ${result ? STATUS_LABEL[result.status] : 'no update yet'}`}
      >
        <Icon size={11} />
      </button>
    </HoverCard>
  );
};
