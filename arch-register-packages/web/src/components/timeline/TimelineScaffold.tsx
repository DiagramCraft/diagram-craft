import { useEffect, useRef, type CSSProperties, type ReactNode, type UIEventHandler } from 'react';
import { getTimelineMinWidthStyle } from './timelineUtils';

type TimelineScaffoldProps = {
  scrollClassName?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
  innerClassName?: string;
  labelWidth: number;
  totalWidth: number;
  todayPx: number | null;
  todayScrollAlign?: number;
  header?: ReactNode;
  todayLine?: ReactNode;
  overlayLines?: ReactNode;
  children: ReactNode;
  innerStyle?: CSSProperties;
};

export const TimelineScaffold = ({
  scrollClassName,
  onScroll,
  innerClassName,
  labelWidth,
  totalWidth,
  todayPx,
  todayScrollAlign = 0.4,
  header,
  todayLine,
  overlayLines,
  children,
  innerStyle
}: TimelineScaffoldProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || todayPx === null) return;
    element.scrollLeft = Math.max(0, labelWidth + todayPx - element.clientWidth * todayScrollAlign);
  }, [labelWidth, todayPx, todayScrollAlign]);

  return (
    <div className={scrollClassName ?? ''} ref={scrollRef} onScroll={onScroll}>
      <div
        className={innerClassName ?? ''}
        style={getTimelineMinWidthStyle(labelWidth, totalWidth, innerStyle)}
      >
        {header}
        {todayLine}
        {overlayLines}
        {children}
      </div>
    </div>
  );
};
