import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { TimelineScaffold } from './TimelineScaffold';
import {
  buildTimelineRange,
  getTodayTimelinePx,
  stringDateToTimelinePx,
  type TimelineColumnWidths,
  type TimelineRange,
  type TimelineZoom
} from './timelineUtils';

export type SnapshotTimelineMarker = {
  milestone: Milestone;
  px: number;
};

export type SnapshotTimelineContext = TimelineRange & {
  today: Date;
  todayPx: number | null;
  milestoneMarkers: SnapshotTimelineMarker[];
};

export type SnapshotTimelineContextArgs = {
  dates: Date[];
  zoom: TimelineZoom;
  columnWidths: TimelineColumnWidths;
  milestones?: Map<string, Milestone>;
  today?: Date;
};

export const buildSnapshotTimelineContext = ({
  dates,
  zoom,
  columnWidths,
  milestones = new Map(),
  today = new Date()
}: SnapshotTimelineContextArgs): SnapshotTimelineContext => {
  const range = buildTimelineRange({ dates, zoom, columnWidths, today });
  const milestoneMarkers = [...milestones.values()]
    .map(milestone => ({
      milestone,
      px: stringDateToTimelinePx(
        milestone.target_date,
        range.rangeStart,
        range.rangeEnd,
        range.totalWidth
      )
    }))
    .filter((marker): marker is SnapshotTimelineMarker => marker.px !== null);

  return {
    ...range,
    today,
    todayPx: getTodayTimelinePx(today, range.rangeStart, range.rangeEnd, range.totalWidth),
    milestoneMarkers
  };
};

export const useSnapshotTimeline = (args: SnapshotTimelineContextArgs) => {
  const { dates, zoom, columnWidths, milestones, today } = args;
  return useMemo(
    () => buildSnapshotTimelineContext({ dates, zoom, columnWidths, milestones, today }),
    [dates, zoom, columnWidths, milestones, today]
  );
};

export type SnapshotTimelineClasses = {
  head: string | undefined;
  corner: string | undefined;
  cornerLabel: string | undefined;
  columns: string | undefined;
  column: string | undefined;
  currentColumn: string | undefined;
  today: string | undefined;
  todayPip: string | undefined;
  milestoneLine: string | undefined;
  milestoneLabel: string | undefined;
};

export type SnapshotTimelineShellProps = {
  context: SnapshotTimelineContext;
  labelWidth: number;
  classes: SnapshotTimelineClasses;
  cornerLabel: ReactNode;
  scrollClassName?: string;
  innerClassName?: string;
  todayScrollAlign?: number;
  showHeader?: boolean;
  showToday?: boolean;
  showMilestones?: boolean;
  milestoneAriaLabel?: (milestone: Milestone) => string;
  children: ReactNode;
  innerStyle?: CSSProperties;
};

export const SnapshotTimelineShell = ({
  context,
  labelWidth,
  classes,
  cornerLabel,
  scrollClassName,
  innerClassName,
  todayScrollAlign,
  showHeader = true,
  showToday = true,
  showMilestones = true,
  milestoneAriaLabel,
  children,
  innerStyle
}: SnapshotTimelineShellProps) => {
  const { columns, totalWidth, todayPx, milestoneMarkers } = context;
  const className = (value: string | undefined) => value ?? '';

  return (
    <TimelineScaffold
      scrollClassName={scrollClassName}
      innerClassName={innerClassName}
      labelWidth={labelWidth}
      totalWidth={totalWidth}
      todayPx={showToday ? todayPx : null}
      todayScrollAlign={todayScrollAlign}
      innerStyle={innerStyle}
      header={
        showHeader ? (
          <div className={className(classes.head)}>
            <div className={className(classes.corner)}>
              <span className={className(classes.cornerLabel)}>{cornerLabel}</span>
            </div>
            <div className={className(classes.columns)} style={{ width: totalWidth }}>
              {columns.map((column, index) => (
                <div
                  key={index}
                  className={`${className(classes.column)} ${
                    column.isCurrent ? className(classes.currentColumn) : ''
                  }`}
                  style={{ width: column.width }}
                >
                  {column.label}
                </div>
              ))}
            </div>
          </div>
        ) : null
      }
      todayLine={
        showToday && todayPx !== null ? (
          <div className={className(classes.today)} style={{ left: labelWidth + todayPx }}>
            <span className={className(classes.todayPip)}>▾</span>
          </div>
        ) : null
      }
      overlayLines={
        showMilestones
          ? milestoneMarkers.map(({ milestone, px }) => (
              <div
                key={milestone.id}
                role="img"
                className={className(classes.milestoneLine)}
                style={{ left: labelWidth + px }}
                title={`${milestone.name} (${milestone.target_date})`}
                aria-label={
                  milestoneAriaLabel?.(milestone) ??
                  `Milestone: ${milestone.name} (${milestone.target_date})`
                }
              >
                <span
                  className={className(classes.milestoneLabel)}
                  title={`${milestone.name} (${milestone.target_date})`}
                >
                  {milestone.name}
                </span>
              </div>
            ))
          : null
      }
    >
      {children}
    </TimelineScaffold>
  );
};
